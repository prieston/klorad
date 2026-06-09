/**
 * Generic data-source connector contract.
 *
 * Every Klorad vertical pulls live data from one or more external
 * systems (ATMS for Mobility, MappedIn for Campus indoor, museum
 * collection APIs for Heritage, etc.). This package gives all of
 * them one shape so the consuming app only has to learn how to
 * register an adapter once.
 *
 * The contract is intentionally narrow:
 *   - `configure` is pure: no network, just key bookkeeping.
 *   - `testConnection` is the one-round-trip credential check the
 *     "Test connection" button in the settings UI calls before save.
 *   - `listEntities` is **cursor-paginated** via AsyncIterable so the
 *     caller can persist + filter pages as they arrive, not after the
 *     full set is in memory. Long catalogs (thousands of cameras)
 *     stream cleanly.
 *   - `getEntity` / `getStatus` are point lookups — same shape as
 *     `listEntities` items, but for a known id.
 *
 * Adapters live in apps or sibling packages (e.g. an `inet-atms`
 * adapter for the Parsons iNET ATMS), and are registered against
 * `ConnectorRegistry` at boot. The framework knows nothing about
 * any specific system — that's the whole point.
 */
import type { ZodSchema } from "zod";

export interface ConnectionTestResult {
  ok: boolean;
  /** Surface-friendly message — shown in the settings UI. */
  error?: string;
  /** Optional diagnostic info (e.g. count of devices visible to
   *  the configured user, API version detected). Adapter-defined. */
  meta?: Record<string, unknown>;
}

export interface ListParams {
  /** Page size hint. The adapter is free to return less. */
  limit?: number;
  /** Opaque cursor from a previous `EntityPage.nextCursor`. */
  cursor?: string;
  /** Adapter-defined free-text query. */
  query?: string;
  /** Sort directives, e.g. `["+name", "-createdAt"]`. */
  sort?: string[];
  /** Bias toward results near a point — adapters that don't support
   *  spatial filtering can ignore this. */
  near?: { lat: number; lng: number };
}

export interface EntityPage<T> {
  items: T[];
  /** Token to feed back as `params.cursor` on the next call.
   *  `null` means end-of-catalog. */
  nextCursor: string | null;
}

/**
 * Source-of-truth contract every Klorad data-source connector
 * implements. Generic over its config + entity + status shapes so
 * adapters stay type-safe end-to-end without `any`.
 */
export interface KloradConnector<TConfig, TEntity, TStatus = unknown> {
  /** Stable id used by the registry — kebab-case (`inet-atms`). */
  readonly id: string;

  /** Idempotent config setup. Validates with `configSchema`, stores
   *  what the runtime needs. **Never makes a network call.** */
  configure(config: TConfig): Promise<void>;

  /** One round-trip credential / reachability check. Called by the
   *  settings UI's "Test connection" button before persistence. */
  testConnection(): Promise<ConnectionTestResult>;

  /** Cursor-paginated catalog stream. Yields one `EntityPage` at a
   *  time. The caller decides what to persist; the connector never
   *  writes to storage. */
  listEntities(params?: ListParams): AsyncIterable<EntityPage<TEntity>>;

  /** Single-entity point lookup. `null` when the id is unknown. */
  getEntity(id: string): Promise<TEntity | null>;

  /** Bulk status fetch. Keyed by entity id. Missing ids are simply
   *  absent from the returned record (not `null`). */
  getStatus(ids: string[]): Promise<Record<string, TStatus>>;
}

/**
 * Authentication shape. Drives which credential form the settings UI
 * renders for an adapter. New shapes can be added as more adapters
 * land; the UI gracefully falls back to a generic JSON editor when
 * it doesn't know the shape.
 */
export type ConnectorAuthType = "basic" | "bearer" | "api-key" | "oauth";

/**
 * One side of the registry record. Apps register a factory; the
 * registry uses it to build connector instances on demand. Keeping
 * the factory separate from the instance means each tenant gets a
 * fresh configured connector without leaking state across requests.
 */
export interface ConnectorFactory<
  TConfig,
  TEntity,
  TStatus = unknown,
> {
  /** Matches `KloradConnector.id`. Unique inside a registry. */
  readonly id: string;
  /** Human-readable name surfaced in the "Add data source" picker. */
  readonly label: string;
  /** Optional short description shown under the label. */
  readonly description?: string;
  /** Authentication style — drives the credential form. */
  readonly authType: ConnectorAuthType;
  /** Zod schema for the connector config (auth + tunables). Apps
   *  validate user input through this before calling `create()`. */
  readonly configSchema: ZodSchema<TConfig>;
  /** Build a fresh connector instance. */
  create(): KloradConnector<TConfig, TEntity, TStatus>;
}

/** Compact registry record used by `ConnectorRegistry.list()` — the
 *  shape the data-source picker UI iterates over. */
export interface ConnectorDescriptor {
  id: string;
  label: string;
  description?: string;
  authType: ConnectorAuthType;
}
