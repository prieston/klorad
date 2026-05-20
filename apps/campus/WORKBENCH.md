# Workbench

A design doc for the structural editor that will replace the campus
builder at `apps/campus/maps/[mapId]/builder/*`. The architecture is
platform-wide; campus is the first consumer.

> **Status: draft for review.** Contracts below are proposals, not yet
> implemented. Open questions are listed at the end. Push back on any of
> it.

---

## 1. What the Workbench is

Three surfaces inside any Klorad vertical, in increasing intimacy with
the data:

| Surface | Who's there | What they do |
|---|---|---|
| **Public viewer** | Anyone with the link | Read, navigate, search |
| **Dashboard** | Team members | Cross-world management (lists, settings, members) |
| **Workbench** | Editors | Shape the contents of one world |

The Workbench is the **structural editor** for one world. A world here
is a campus, a heritage site, a mobility corridor, a city footprint. A
world contains typed entities. The Workbench lets you add, edit, link,
delete, and organize them, then publish the result to the public viewer.

The Workbench is **not** a 3D editor. It is a system whose views
include 3D. A table is a peer view. A timeline is a peer view. The 3D
map is one way to see and act on entities; the table is another. The
current MUI builder conflates "the editor" with "the 3D map", which
this redesign exists to undo.

Each vertical provides its own **Workbench config**: which entity
types, which views, which operations, what the default layout is. The
shell is shared.

---

## 2. Why the current builder needs replacing

`apps/campus/maps/[mapId]/builder/` today is ~3,600 lines across
`BuilderClient`, `BuilderLeftPanel`, `BuildingsView`, `POIsView`,
`FloorPlanDrawer`, `ProjectHealthPanel`, `Breadcrumbs`. The shape is:

- One root client component owns most state
- A fixed left sidebar with tabbed sub-views (POIs / Buildings / …)
- A fixed center 3D map
- Operations are buttons on the panels, tightly coupled to the panel's
  view of the data

Two problems:

1. **The 3D map is the editor.** Everything else hangs off it.
   Adding a Table view, a Timeline view, or a Hierarchy view means
   carving them out of the sidebar and competing with the 3D map for
   focus. That's not a layout extension, that's a rewrite.
2. **Operations live on panels.** "Delete POI" is a method on the POI
   panel. The 3D map can't trigger it cleanly. A command palette
   can't. An AI assistant can't. Every new affordance for an existing
   operation means a new code path.

A straight MUI-to-DS swap would freeze both of these into the new
visual system. That's the move this redesign exists to skip.

---

## 3. Conceptual model

Six concepts. The first four are data; the last two are runtime.

### 3.1 World

The unit of editing. One world has one config (its vertical), one set
of entities, one set of editors. Routes are `/world/:id/...`.

In campus today, a world is a `Map`. The migration keeps that table —
worlds are just typed maps.

### 3.2 Entity

A typed thing in the world. Examples by vertical:

- **Campus**: POI, Building, FloorPlan, Tour, Event, Sensor
- **Heritage**: Reconstruction, Document, Period, Stop, Artifact
- **Mobility**: Corridor, Intersection, Sensor, Sign, Speed Sample
- **Urban**: Parcel, Building, Layer, Sensor, Permit

Every entity has a **type** (from `@klorad/config`), an `id`, a
`worldId`, a payload that validates against the type's schema, and an
audit trail. Entities are persisted server-side; the Workbench loads
an entity index for the world it's editing.

### 3.3 View

A way to see and act on entities. A view is a registered React
component. Examples:

- `MapView` — 3D map, renders entities with positions
- `TableView` — tabular, renders any entity type with declared columns
- `HierarchyView` — tree, renders parent/child relationships
- `TimelineView` — temporal axis, renders entities with timestamps
- `OverviewView` — landing page, summary cards

A view declares which entity types it can render. The shell decides
which views are eligible for the current world based on its entity
mix.

The same entity can appear in multiple views simultaneously. Selecting
it in the table also selects it in the map.

### 3.4 Operation

A thing you can do to one or more entities. Examples:

- `entity.edit-properties`
- `entity.delete`
- `poi.link-to-building`
- `floorplan.set-active`
- `world.publish`

An operation is **not** a button. It's a typed function with a name,
a scope (which entity types it applies to), an optional form for
gathering arguments, and an `invoke` implementation. The shell decides
how to surface it: right-click menus, view buttons, the command
palette, keyboard shortcuts, AI suggestions.

### 3.5 Selection

A workbench-wide concept, not a per-view concept. There is one
selection at any time, scoped to the current world. Views read and
write it. Operations apply to it.

Selection is a flat set of entity ids plus a focused id (for the
inspector). It survives view changes.

### 3.6 Actor

Anyone or anything that can run operations. The user is an actor. A
collaborator is an actor (future). An AI assistant is an actor
(future). Operations don't care which.

The actor abstraction exists from day one so the AI slot can drop in
later without rewriting operations.

---

## 4. Contracts

Concrete TypeScript-flavoured proposals. These live in `@klorad/config`
unless noted.

### 4.1 EntityType

```ts
type EntityType<Payload = unknown> = {
  id: string;                          // "campus.poi", "heritage.reconstruction"
  label: string;
  icon?: React.FC<{ className?: string }>;
  schema: z.ZodSchema<Payload>;
  defaults: Payload;
  /** Which views can render this type. */
  views: ViewId[];
  /** Which operations apply to this type. Resolved at registration. */
  operations: OperationId[];
};
```

Entity instances are not part of the contract — they're loaded from
the server. The contract is the **type registration**.

### 4.2 View

```ts
type View = {
  id: string;                          // "map", "table", "hierarchy"
  label: string;
  icon: React.FC<{ className?: string }>;
  /** Which entity types this view can render. "*" = any. */
  entityTypes: EntityTypeId[] | "*";
  /** Where in the dock this view prefers to live by default. */
  defaultDock: DockRegion;
  /** The component. Receives ViewContext via props. */
  component: React.FC<ViewProps>;
};

type ViewProps = {
  ctx: ViewContext;
};

type ViewContext = {
  worldId: string;
  selection: SelectionState;
  setSelection: (next: SelectionState) => void;
  entities: EntityIndex;               // observable, queryable by type and id
  runOperation: <A>(op: OperationId, args: A, on: EntityId[]) => Promise<OpResult>;
  /** Operations applicable to the current selection. Pre-filtered by scope. */
  applicableOperations: ResolvedOperation[];
};
```

The view component never calls fetch or mutates server state directly.
It calls `runOperation`. This is what makes the AI-as-actor slot
viable later.

### 4.3 Operation

```ts
type Operation<Args = void> = {
  id: string;
  label: string;
  /** Entity types this op applies to. */
  scope: EntityTypeId[];
  /** Predicate: given the current selection, does this op apply? */
  applies: (sel: SelectionState, entities: EntityIndex) => boolean;
  /** Optional form for gathering args before invocation. */
  Form?: React.FC<OperationFormProps<Args>>;
  /** The actual work. May call server, may mutate the entity index. */
  invoke: (ctx: OpInvokeContext, args: Args, on: EntityId[]) => Promise<OpResult>;
  /** Optional default keyboard shortcut. */
  shortcut?: string;                   // "mod+d"
};

type OpInvokeContext = {
  worldId: string;
  actor: Actor;                        // who's running this
  entities: EntityIndex;
  toast: (msg: string, tone?: Tone) => void;
};

type OpResult = { ok: true } | { ok: false; reason: string };
```

The shell exposes operations through (a) a right-click context menu
over the selection, (b) a command palette (cmd-k), (c) optional
view-authored buttons that reference the op by id, and (d) the AI
suggestion stream when that ships.

### 4.4 Workbench config

```ts
// apps/campus/workbench.config.ts
import { defineWorkbench } from "@klorad/config/workbench";
import { poiType, buildingType, floorPlanType, tourType, eventType } from "./entities";
import { editProperties, deleteEntity, linkToBuilding, /* … */ } from "./operations";

export default defineWorkbench({
  vertical: "campus",
  entities: [poiType, buildingType, floorPlanType, tourType, eventType],
  views: [mapView, tableView, hierarchyView, overviewView],
  operations: [editProperties, deleteEntity, linkToBuilding /* … */],
  defaultLayout: {
    left: ["hierarchy"],
    center: ["map"],
    right: ["inspector"],
    bottom: [],
  },
});
```

The shell reads this config at boot and assembles itself. Mobility,
Heritage, Urban each ship their own.

### 4.5 Actor

```ts
type Actor =
  | { kind: "user"; userId: string }
  | { kind: "ai"; sessionId: string }
  | { kind: "system"; reason: string };  // e.g. background revalidation

const useActor = (): Actor => /* shell-provided */;
```

For v1, `useActor()` always returns `{ kind: "user", userId }`. The AI
case ships in Phase 6.

---

## 5. Package boundaries

What lives where, decided up front so we don't grow circular deps.

| Package | Owns |
|---|---|
| `@klorad/design-system` | Dock primitive, panel chrome, inspector chrome, command-palette chrome. Pure visual. No knowledge of entities or operations. |
| `@klorad/config` | Entity types, operations, view registration helpers, `defineWorkbench`, the `Actor` abstraction, `EntityIndex` interface. Pure types + runtime registries. No UI. |
| `apps/campus/lib/workbench/` | Campus's entity instance loader, campus operations, campus views. Imports both packages. |
| `apps/campus/app/(dashboard)/org/[orgId]/maps/[mapId]/workbench/` | The Workbench route page that loads campus's config and mounts the shell. |

A view defined in `apps/campus/lib/workbench/views/map.tsx` is
registered into a campus-local registry by importing the campus
config. The shared shell in `@klorad/design-system` never imports
campus code.

---

## 6. Dock layout

A small dock primitive in `@klorad/design-system`.

### 6.1 v1 scope

- Four named regions: `left`, `center`, `right`, `bottom`
- Panels are assigned to regions by the Workbench config
- Per-region: collapse/expand, resize (drag the separator)
- No drag-to-rearrange between regions in v1
- Layout state persists in `localStorage` keyed by `worldId`; per-user
  server persistence is Phase 4

### 6.2 Why not a generic floating-windows model

Because we don't need it. Most editors that ship "rearrange anywhere"
docks (VS Code, Blender, after-effects) have multi-decade UX research
to back them. We don't, yet. A four-region dock with collapse and
resize handles 95% of cases and is two orders of magnitude less code.

If the constraint becomes painful we extend; we don't pre-build.

### 6.3 Mobile

The dock collapses to a single-view mode on small screens. The user
picks one view at a time from a bottom bar. The inspector becomes a
sheet. Selection still bridges views.

---

## 7. Operation surfacing

A given operation can be reached three ways:

1. **Right-click on selection.** Filter ops by scope ∩ selection.
2. **Command palette (`mod+k`).** All applicable ops; fuzzy search by
   label.
3. **View-authored buttons.** A view's component can render a button
   that calls `ctx.runOperation('poi.link-to-building', ...)`. Buttons
   are just affordances; they don't own the op.

The AI actor (Phase 6) gets a fourth: it can call
`runOperation` programmatically with args it inferred. Approval gating
lives in the shell, not in each operation.

---

## 8. Selection model

```ts
type SelectionState = {
  ids: Set<EntityId>;                  // what's selected
  focusedId: EntityId | null;          // what the inspector targets
  // Future: typed metadata per id (drag handle position, edit mode, …)
};
```

- Set semantics. Most operations apply to N entities; "edit
  properties" applies only when N === 1 (it disables otherwise).
- Selection survives view switches.
- Each view decides how to visualize the selection (highlights in 3D,
  row checkboxes in the table, ring on the hierarchy node).
- Multi-select with `shift` and `mod` is a shell affordance, not a
  view affordance — views call `setSelection` with already-computed
  next states. The shell provides a `selectionFromClick` helper.

---

## 9. AI-as-actor slot

The hook is in from day one; the model is not.

```ts
// shell-provided
const actor = useActor();
// always { kind: "user", userId } in v1
```

Operations receive `actor` in their `invoke` context. Audit logs
record it. Permission checks key off it (`actor.kind === "ai"` may
have different scopes than a user — we decide later).

When the AI ships:

- A side panel (right dock, or floating) shows the assistant's stream.
- The assistant has read access to the entity index and selection.
- The assistant proposes operations via the same `runOperation`
  interface, with `actor: { kind: "ai", sessionId }`.
- The shell intercepts AI invocations and shows a confirmation gate
  (user clicks approve). Approval policies (auto-approve some, prompt
  for others) come later.

No AI code lives in any view or operation. Views and operations are
actor-agnostic. The AI panel is just another dock panel that knows
how to issue `runOperation` calls.

---

## 10. Migration plan

Six phases. Each lands as its own PR. Phases 1-4 happen in parallel
with the current builder still running.

### Phase 1 — Extract entity types into `@klorad/config`

- Define `EntityType`, `Operation`, `View` types in
  `@klorad/config/workbench`.
- Move POI / Building / FloorPlan / Tour / Event schemas from
  campus-internal code into typed entities.
- The current builder keeps working — it doesn't yet know about the
  registry.
- **Test signal**: campus typecheck + the current builder still
  renders.
- **Size**: medium. ~500 lines.

### Phase 2 — Build the Workbench shell

- Dock primitive in `@klorad/design-system`.
- View registry + `defineWorkbench` in `@klorad/config`.
- A new route `/maps/[mapId]/workbench` that loads the campus config
  and mounts the shell with a single placeholder view ("Hello world,
  this is a view") so the plumbing is testable.
- Old `/builder` route untouched.
- **Test signal**: navigate to `/workbench`, see the dock.
- **Size**: medium. ~600 lines.

### Phase 3 — Port the 3D map as a view

- Wrap today's `BuilderClient`'s 3D scene as a `MapView` that talks to
  the entity index instead of its own state.
- Same visual output; different ownership.
- **Test signal**: 3D scene renders inside the Workbench shell;
  selecting a POI in 3D updates the shell's selection state.
- **Size**: medium-large. ~800 lines.

### Phase 4 — Add Table, Hierarchy, Overview views

- `TableView` — generic table over an entity type
- `HierarchyView` — parent/child tree (buildings → floors → rooms,
  POIs grouped by building)
- `OverviewView` — landing summary
- These are all new components; they consume the same entity index.
- **Test signal**: switch views, selection bridges, operations
  trigger.
- **Size**: large. ~1,200 lines.

### Phase 5 — Operations migration

- Inventory every "thing you can do" in the current builder.
- Register each as a typed Operation.
- Wire them to the right-click menu, command palette, and existing
  view buttons.
- **Test signal**: every action available in `/builder` is available
  in `/workbench`.
- **Size**: medium-large. ~700 lines.

### Phase 6 — Swap routes and delete

- `/maps/[mapId]/builder` becomes a redirect to `/workbench`.
- Old builder code deleted.
- **Test signal**: clean git diff, no references to `BuilderClient`
  remain.
- **Size**: small. ~200 lines (mostly deletes).

### Phase 7 — Actor scaffolding + AI panel placeholder

- `useActor()` hook lands.
- Empty AI panel registered as an optional dock panel.
- No model wired.
- **Test signal**: `useActor()` returns `{ kind: "user" }`; the AI
  panel renders an empty state.
- **Size**: small. ~150 lines.

Total ballpark: 6-8 weeks of work for one engineer, more reviewable as
seven distinct PRs than as one.

---

## 11. What this is not

To keep scope honest:

- **Not a 3D engine rewrite.** The MapView wraps today's Cesium /
  Mapbox setup. Engine work is its own track.
- **Not a permissions overhaul.** Workbench-level role gating uses
  the existing org member roles. Per-operation policies come later.
- **Not real-time collaboration.** Multiple users in the same
  Workbench at once is a Phase 8+ topic. Selection is local for v1.
- **Not a public-viewer redesign.** The viewer is a separate route
  that reads the same entity data. Workbench changes don't touch it.
- **Not config-as-code that users edit.** `defineWorkbench` is
  developer-facing. End-users never see TypeScript.

---

## 12. Open questions

Not for this doc to answer, but worth deciding before the relevant
phase lands.

1. **Entity persistence.** Today's `Map.sceneData` blob holds POIs,
   buildings, etc. as a JSON soup. Does the Workbench keep using that
   blob (with typed accessors) or split entities into their own
   tables? Schema migration is real either way; the question is when.
2. **Concurrent edits.** Two editors on the same world. v1 stays
   last-write-wins; do we need optimistic concurrency tokens earlier
   than Phase 8?
3. **Public-link Workbench-derived views.** Should the public viewer
   support showing the table or the hierarchy as read-only views, or
   stay 3D-only?
4. **Mobile editing.** Is the Workbench an editing surface on mobile,
   or read-only with edits restricted to desktop?
5. **Versioning of entity schemas.** When `poiType.schema` changes,
   how do we migrate existing instances? Migrations table? Schema
   version field on each entity?
6. **Operation undo.** Do operations form a stack with reverse-ops, or
   is undo a global journal of state snapshots?
7. **AI approval policy.** When the AI proposes an operation, does it
   always prompt? Some operations are clearly safe (rename one POI),
   some clearly aren't (delete twenty). Where's the line?
8. **`@klorad/config` is currently small.** Does this expansion (entity
   types, operations, views, `defineWorkbench`) push it past being a
   "config" package and into being a real platform-runtime package
   that deserves a renaming?

---

## 13. Next step

If the shape above is right, the first concrete code change is **Phase
1: extract entity types**. That's bounded, has no UI risk, and unlocks
everything after it.

If the shape is wrong, this doc is what to push back on.
