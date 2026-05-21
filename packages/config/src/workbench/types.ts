/**
 * Workbench — type contracts.
 *
 * The Workbench is the structural editor for any Klorad vertical. Each
 * vertical ships a `WorkbenchConfig` (typed entities + views + operations +
 * a default dock layout). The shared shell reads that config and assembles
 * itself.
 *
 * See `apps/campus/WORKBENCH.md` for the full architectural rationale.
 *
 * Phase 1 — types only. The shell that reads these (dock primitive, view
 * registry, command palette, …) lands in Phase 2.
 */

/* ─── ID brands ──────────────────────────────────────────────────────── */

/** Stable id for one entity instance (a specific POI, a specific Building). */
export type EntityId = string;
/** Stable id for an entity *type* (e.g. "campus.poi", "heritage.reconstruction"). */
export type EntityTypeId = string;
/** Stable id for a view (e.g. "map", "table", "hierarchy"). */
export type ViewId = string;
/** Stable id for an operation (e.g. "entity.edit-properties"). */
export type OperationId = string;

/* ─── Schemas ────────────────────────────────────────────────────────── */

/**
 * Minimal schema interface for entity payload validation. A zod `ZodType`
 * satisfies this directly; other validators (valibot, ajv, custom) can be
 * adapted in a few lines.
 */
export interface EntitySchema<T> {
  /** Validate, throw on failure. Returns the parsed value. */
  parse(value: unknown): T;
  /** Validate without throwing — return a discriminated result. Optional. */
  safeParse?(
    value: unknown,
  ): { success: true; data: T } | { success: false; error: unknown };
}

/* ─── Entities ───────────────────────────────────────────────────────── */

/**
 * Declares one kind of thing in a world: POI, Building, Reconstruction, …
 * The runtime instance is `Entity<Payload>`; this is the *registration*.
 */
export interface EntityType<Payload = unknown> {
  id: EntityTypeId;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  schema: EntitySchema<Payload>;
  defaults: Payload;
  /** Which views are eligible to render this type. */
  views: ViewId[];
  /** Which operations apply to this type. Resolved against the registry at boot. */
  operations: OperationId[];
}

/** One instance in a world. The vertical-specific data lives in `payload`. */
export interface Entity<Payload = unknown> {
  id: EntityId;
  typeId: EntityTypeId;
  worldId: string;
  payload: Payload;
  createdAt: string;
  updatedAt: string;
}

/**
 * What a view receives as data. Implementations are free to back this with
 * SWR, a zustand store, an observable, or anything else.
 */
export interface EntityIndex {
  byId(id: EntityId): Entity | undefined;
  byType(typeId: EntityTypeId): Entity[];
  all(): Entity[];
  /** Listener invoked whenever the index changes. Returns an unsubscribe fn. */
  subscribe(listener: () => void): () => void;
}

/* ─── Selection ──────────────────────────────────────────────────────── */

/**
 * Workbench-wide selection. There is one selection at a time, scoped to the
 * current world. Views read and write it; operations apply to it.
 */
export interface SelectionState {
  /** Selected entity ids. */
  ids: ReadonlySet<EntityId>;
  /** The id the inspector targets. May be null even with non-empty `ids`. */
  focusedId: EntityId | null;
}

/* ─── Actor ──────────────────────────────────────────────────────────── */

/**
 * Anyone or anything that can run operations. The user is an actor, an AI
 * assistant is an actor (Phase 7), a system process is an actor.
 *
 * The abstraction exists from day one so operations stay actor-agnostic.
 */
export type Actor =
  | { kind: "user"; userId: string }
  | { kind: "ai"; sessionId: string }
  | { kind: "system"; reason: string };

/* ─── Operations ─────────────────────────────────────────────────────── */

export type ToastTone = "info" | "success" | "warning" | "error";

export type OpResult = { ok: true } | { ok: false; reason: string };

/** Context handed to an operation when it runs. */
export interface OpInvokeContext {
  worldId: string;
  /** Who initiated this run. `kind === "ai"` will go through approval gates. */
  actor: Actor;
  entities: EntityIndex;
  toast(msg: string, tone?: ToastTone): void;
}

/** Props for an operation's optional argument-gathering form. */
export interface OperationFormProps<Args = unknown> {
  initialArgs?: Args;
  submit(args: Args): void;
  cancel(): void;
}

/**
 * A typed function with a name, an entity-type scope, and an `invoke`.
 * Operations are not buttons — the shell decides surfacing (right-click,
 * command palette, view-authored button, keyboard, AI suggestion).
 */
export interface Operation<Args = void> {
  id: OperationId;
  label: string;
  /**
   * Optional icon used by generic rendering surfaces — view-authored
   * buttons, command palette entries, right-click menu items. Falls
   * back to label-only if absent.
   */
  icon?: React.ComponentType<{ className?: string }>;
  /** Entity types this operation applies to. */
  scope: EntityTypeId[];
  /** Predicate evaluated against the current selection. */
  applies(sel: SelectionState, entities: EntityIndex): boolean;
  /** Optional form for gathering `Args` from the user before `invoke`. */
  Form?: React.ComponentType<OperationFormProps<Args>>;
  /**
   * Optional pre-populator for the Form. Called by the shell when it
   * opens the Form modal; the returned value is passed as
   * `initialArgs`. Skipped if the op has no Form.
   */
  initialArgs?(
    ctx: Pick<OpInvokeContext, "worldId" | "entities">,
    on: EntityId[],
  ): Args | undefined;
  /** The work. May call the server, mutate the entity index, etc. */
  invoke(
    ctx: OpInvokeContext,
    args: Args,
    on: EntityId[],
  ): Promise<OpResult>;
  /** Default keyboard shortcut, e.g. `"mod+d"`. Consumers may rebind. */
  shortcut?: string;
}

/**
 * What a view sees in `ctx.applicableOperations`: an operation pre-bound to
 * the subset of selected entities that fall in its scope.
 */
export interface ResolvedOperation<Args = unknown> {
  operation: Operation<Args>;
  on: EntityId[];
}

/* ─── Views ──────────────────────────────────────────────────────────── */

/** Where a view prefers to live by default. The user can move it later. */
export type DockRegion = "left" | "center" | "right" | "bottom";

/** Data and callbacks every view receives. */
export interface ViewContext {
  worldId: string;
  selection: SelectionState;
  setSelection(next: SelectionState): void;
  entities: EntityIndex;
  /**
   * Run an operation. The shell looks up the operation by id, runs the
   * approval gate if the actor is AI, then invokes it.
   */
  runOperation<A>(
    op: OperationId,
    args: A,
    on: EntityId[],
  ): Promise<OpResult>;
  /** Operations applicable to the current selection, scope-filtered. */
  applicableOperations: ResolvedOperation[];
  /**
   * Compute the operations applicable to one entity, independent of
   * the current selection. Used by right-click menus and any other
   * surface that targets a single entity. The returned ops are bound
   * to `on: [entityId]`.
   */
  operationsForEntity(entityId: EntityId): ResolvedOperation[];
}

export interface ViewProps {
  ctx: ViewContext;
}

/**
 * A view is a registered React component. Views never fetch or mutate
 * server state directly — they call `ctx.runOperation`. This is what makes
 * the AI-as-actor slot drop in later without rewriting views.
 */
export interface View {
  id: ViewId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Which entity types this view can render. `"*"` accepts any type. */
  entityTypes: EntityTypeId[] | "*";
  /** Where this view prefers to live in the dock by default. */
  defaultDock: DockRegion;
  component: React.ComponentType<ViewProps>;
}

/* ─── Dock layout ────────────────────────────────────────────────────── */

/**
 * Which views go where on first render. The dock persists user overrides
 * per-world; this is just the starting state.
 */
export interface DockLayout {
  left: ViewId[];
  center: ViewId[];
  right: ViewId[];
  bottom: ViewId[];
}

/* ─── Workbench config ───────────────────────────────────────────────── */

/**
 * The complete configuration a vertical ships. Imported by the shell to
 * assemble itself. See `defineWorkbench` for the factory consumers actually
 * call.
 */
export interface WorkbenchConfig {
  /** Which Klorad vertical owns this config: "campus", "mobility", … */
  vertical: string;
  entities: EntityType[];
  views: View[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  operations: Operation<any>[];
  defaultLayout: DockLayout;
}
