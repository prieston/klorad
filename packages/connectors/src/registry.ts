/**
 * Connector registry — apps register adapter factories at boot; the
 * settings UI + sync runner read from the same registry by id.
 *
 * Deliberately tiny. Adapters live elsewhere; the registry holds
 * pointers and metadata only.
 */
import type {
  ConnectorDescriptor,
  ConnectorFactory,
  KloradConnector,
} from "./types.js";

export class ConnectorRegistry {
  // The factory shapes are heterogeneous per adapter, so the map
  // value is intentionally typed loosely; the `get` overload
  // narrows for the caller.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly factories = new Map<string, ConnectorFactory<any, any, any>>();

  /** Register an adapter. Throws on duplicate ids so a typo doesn't
   *  silently overwrite a working adapter. */
  register<TConfig, TEntity, TStatus = unknown>(
    factory: ConnectorFactory<TConfig, TEntity, TStatus>,
  ): void {
    if (this.factories.has(factory.id)) {
      throw new Error(
        `[connectors] duplicate registration: "${factory.id}" is already registered.`,
      );
    }
    this.factories.set(factory.id, factory);
  }

  /** Fetch a factory by id. The caller knows the expected generics
   *  for the adapter it wrote, so the cast is safe at the call site. */
  get<TConfig, TEntity, TStatus = unknown>(
    id: string,
  ): ConnectorFactory<TConfig, TEntity, TStatus> | undefined {
    return this.factories.get(id) as
      | ConnectorFactory<TConfig, TEntity, TStatus>
      | undefined;
  }

  /** Build a fresh connector instance by id. Convenience around
   *  `get(id)?.create()` that throws when the id is unknown — most
   *  callers want the throw, not the `undefined`. */
  create<TConfig, TEntity, TStatus = unknown>(
    id: string,
  ): KloradConnector<TConfig, TEntity, TStatus> {
    const factory = this.get<TConfig, TEntity, TStatus>(id);
    if (!factory) {
      throw new Error(`[connectors] no factory registered for "${id}"`);
    }
    return factory.create();
  }

  /** Compact list of registered adapters — for the data-source
   *  picker UI. Stable order is insertion order. */
  list(): ConnectorDescriptor[] {
    return Array.from(this.factories.values()).map((f) => ({
      id: f.id,
      label: f.label,
      description: f.description,
      authType: f.authType,
    }));
  }

  /** Drop all registrations. Useful in tests; never in production. */
  clear(): void {
    this.factories.clear();
  }
}
