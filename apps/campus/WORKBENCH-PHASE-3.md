# Workbench Phase 3 — port the 3D map as a View

> **Status: scoping draft for review.** Decisions below are proposals.
> Push back on anything that smells wrong before any code starts.
>
> Companion to `WORKBENCH.md` §10. Focused on Phase 3 only.

---

## 1. Goal restated

Today: `apps/campus/maps/[mapId]/builder/BuilderClient.tsx` (1,511 lines)
mounts the 3D Mapbox scene and owns most state itself.

After Phase 3: that same 3D scene is a `View` registered in the
Workbench. The visual is unchanged; ownership moves to the shell.
Selection bridges across views; operations dispatch through
`ctx.runOperation`.

**`/builder` keeps working unchanged** through Phase 3. Both routes
share the engine code. Phase 6 deletes `/builder`.

---

## 2. What the current builder owns

Reading `BuilderClient.tsx` from top to bottom, three layers stack
inside it. Each maps cleanly to a future home.

| Layer | Today's owner | Future home |
|---|---|---|
| **Engine bootstrap** — `MapboxViewer` dynamic import, container ref, the eight `useMapbox*Layer` hooks (POIs, floor plans, rooms, drawn buildings, floor slabs), `useSceneStore`, undo/redo, `createSceneAPI` | inlined inside `BuilderClient` | extracted into a `useCampusScene` hook |
| **Editor UI** — `BuilderLeftPanel`, `BuildingsView`, `POIsView`, `FloorPlanDrawer`, `ProjectHealthPanel`, the toolbar, scene-tool state | inlined inside `BuilderClient` | stays inside `BuilderClient` for now; gradually moved into Workbench views in Phase 4 |
| **Selection + interaction wiring** — POI/Building click → highlight, drag, scene-tool dispatch | tangled across the three layers | exposed as the bridge between the engine hook and `ctx.selection` / `ctx.runOperation` |

The good news: the eight `useMapbox*Layer` hooks already isolate most
engine logic. Phase 3 is mostly **plumbing** — wrap, expose, bridge.

---

## 3. What "talks to the entity index" means, concretely

Today the 3D scene reads from `Map.sceneData`:

```ts
const scene = map.sceneData as { objects?: Poi[]; ... };
const pois = scene.objects.filter((o) => o?.meta?.poi);
```

After Phase 3 the same data flows through the entity index:

```ts
const pois = ctx.entities.byType("campus.poi"); // -> Entity<POI>[]
```

**v1 is read-through, not write-through.** The entity index for v1 is a
zustand-backed adapter that reads `Map.sceneData` and surfaces it as
`Entity<POI>` / `Entity<Building>` / `Entity<FloorPlan>` / etc. Writes
still go through the existing `createSceneAPI` paths inside the engine
hook — the Workbench doesn't yet route them through
`ctx.runOperation`. That's Phase 5.

**Why this split:** wiring writes through `runOperation` requires
operations to exist (Phase 5). Wiring reads through `entities` only
requires the adapter. Splitting them lets Phase 3 land without
Phase 5's surface, and lets the `/builder` route keep working since
its write paths are unchanged.

The adapter:

```ts
// apps/campus/lib/workbench/runtime/campus-entity-index.ts
export function createCampusEntityIndex(
  sceneData: SceneData | null
): EntityIndex {
  return {
    byId(id) { … look up across pois/buildings/floor-plans/tour-stops/events … },
    byType(typeId) {
      switch (typeId) {
        case "campus.poi":         return scenePOIs(sceneData);
        case "campus.building":    return sceneBuildings(sceneData);
        case "campus.floor-plan":  return sceneFloorPlans(sceneData);
        case "campus.tour-stop":   return sceneTourStops(sceneData);
        case "campus.event":       return sceneEvents(sceneData);
        default:                   return [];
      }
    },
    all() { … flatten the above … },
    subscribe(listener) {
      // Hook into useSceneStore.subscribe so the index re-emits when
      // sceneData changes.
      return useSceneStore.subscribe(listener);
    },
  };
}
```

This adapter is real code that needs writing in Phase 3; it's the
read-side bridge between today's storage and the Workbench's typed
view of the world.

---

## 4. Strategy: shared engine code, two View shells

Two routes will exist together through Phase 3 → Phase 5:

- `/maps/[mapId]/builder`   — today's BuilderClient. Must keep working.
- `/maps/[mapId]/workbench` — the shell. Renders `MapView` in the centre.

The 3D engine code is **shared**, not forked. Both routes call into
the same extracted hook.

```
                  ┌────────────────────────────────────┐
                  │ apps/campus/lib/workbench/         │
                  │   engine/useCampusScene.ts         │
                  │   (the 3D engine — Mapbox + the    │
                  │   eight layer hooks + sceneStore)  │
                  └──────────────┬─────────────────────┘
                                 │
              ┌──────────────────┴──────────────────┐
              │                                     │
              ▼                                     ▼
  BuilderClient.tsx (today)             MapView (Phase 3)
  unchanged UX:                          new wrapper:
  - calls useCampusScene()               - calls useCampusScene()
  - mounts its own left panel /          - exposes selection via
    health panel / toolbar                 ctx.setSelection
                                         - read-only entity bridge
                                           via ctx.entities
```

`BuilderClient` keeps its left panel / health panel / toolbar untouched.
Those move into Workbench views in Phase 4 — not Phase 3.

---

## 5. Extraction plan

Five steps. Each lands as its own commit on the Phase 3 branch.

### Step 1 — Extract `useCampusScene`

Pull the engine bootstrap out of `BuilderClient`:

- The `MapboxViewer` dynamic import + container ref
- The eight `useMapbox*Layer` hooks
- `useSceneStore` integration
- `useUndoRedo`
- `usePolygonDraw`
- `createSceneAPI` instance
- Tool-state machine for scene tools

Returns:
```ts
type CampusSceneHandle = {
  mapRef: RefObject<MapboxMap | null>;
  mapboxViewer: ReactNode;            // the <MapboxViewer ... /> JSX
  api: CampusAPI;
  sceneStore: ReturnType<typeof useSceneStore>;
  tools: { current: SceneTool; set(tool: SceneTool): void };
  undo: { canUndo: boolean; canRedo: boolean; undo(): void; redo(): void };
  // Subscribe hooks for selection / hover events
  onPoiClick(cb: (poiId: string) => void): () => void;
  onBuildingClick(cb: (buildingId: string) => void): () => void;
};

function useCampusScene(mapId: string): CampusSceneHandle;
```

**`BuilderClient.tsx` becomes its consumer.** It's now ~700 lines
instead of 1,511 — most of what got pulled was repeated state setup.
The UI logic (panels, toolbars, dialogs) stays.

**Test signal**: `/builder` renders identically; no visual regression.

**Estimated size**: ~400 lines moved into the new hook, ~800 lines
deleted from `BuilderClient`. Net: roughly even.

### Step 2 — Write the campus EntityIndex adapter

`apps/campus/lib/workbench/runtime/campus-entity-index.ts` — the
read-through adapter from §3.

**Test signal**: typecheck; unit tests for `byType` returning the
expected entity types.

**Estimated size**: ~150 lines.

### Step 3 — Write the `MapView` component

Replace today's placeholder `mapView` in
`apps/campus/lib/workbench/views/map.tsx` with the real wrapper:

```tsx
function MapViewComponent({ ctx }: ViewProps) {
  const scene = useCampusScene(ctx.worldId);

  // Selection bridge: when 3D click happens, propagate to shell
  useEffect(() => {
    const unsubPoi = scene.onPoiClick((id) => {
      ctx.setSelection({ ids: new Set([id]), focusedId: id });
    });
    const unsubBldg = scene.onBuildingClick((id) => {
      ctx.setSelection({ ids: new Set([id]), focusedId: id });
    });
    return () => { unsubPoi(); unsubBldg(); };
  }, [scene, ctx.setSelection]);

  // TODO Phase 5: read ctx.selection.ids -> highlight in 3D

  return <div className="h-full w-full">{scene.mapboxViewer}</div>;
}
```

**Test signal**: `/workbench` shows the real 3D scene; clicking a POI
in 3D updates `ctx.selection`; the placeholder text is gone.

**Estimated size**: ~80 lines for the wrapper + the bridging logic.

### Step 4 — Wire the entity index into the route page

Update `WorkbenchClient.tsx` to load `Map.sceneData` (the same way
the builder does) and pass an entity index to `<Workbench>`:

```tsx
"use client";
import { Workbench } from "@klorad/design-system";
import workbenchConfig from "@/workbench.config";
import { useMap } from "@/app/hooks/useMap";
import { createCampusEntityIndex } from "@/lib/workbench/runtime/campus-entity-index";

export default function WorkbenchClient({ mapId }: { mapId: string }) {
  const { map } = useMap(mapId);
  const entities = useMemo(
    () => createCampusEntityIndex(map?.sceneData ?? null),
    [map?.sceneData]
  );

  return (
    <div className="h-screen w-screen">
      <Workbench config={workbenchConfig} worldId={mapId} entities={entities} />
    </div>
  );
}
```

**Test signal**: `ctx.entities.all().length` is non-zero on a real map;
the placeholder view's stats reflect real data.

**Estimated size**: ~30 lines + a `useMap` hook if one doesn't already
exist (it does — `apps/campus/app/hooks/useMaps.ts` exposes per-map
data).

### Step 5 — `BuilderClient` switches to `useCampusScene`

Refactor `BuilderClient.tsx` to consume the new hook. Net: it shrinks
by ~800 lines.

**Test signal**: `/builder` renders, behaves, saves, and looks
identical to before. Critical — no regressions for current users.

**Estimated size**: largely a deletion. The git diff is large but the
logic is straightforward.

---

## 6. The selection bridge

The Workbench has one selection at a time, scoped to the current world.
Phase 3 wires the 3D side of that bridge.

### Read direction: 3D click → shell selection

Today: POI/Building clicks fire callbacks inside `BuilderClient` that
update local state.

After Phase 3: those callbacks become events on the `useCampusScene`
handle. `MapView` subscribes and calls `ctx.setSelection`.

### Write direction: shell selection → 3D highlight

**Deferred to Phase 5** alongside operations. v1 doesn't push selection
back into the 3D scene — the engine still highlights what it clicked,
the shell knows about it, but other views (Table, Hierarchy) just
don't exist yet to react.

Implementing the write direction in Phase 3 would mean a custom
"select these ids" path through every `useMapbox*Layer` hook. Worth
doing once we know what the other views demand of it.

---

## 7. Coexistence and rollback

`/builder` and `/workbench` both alive through Phases 3, 4, 5.

- Both call `useCampusScene` — single source of engine truth.
- Same Mapbox instance pattern; same scene store; same undo stack.
- Different surrounding UI: builder has its existing left panel /
  health panel / toolbar; workbench has the dock with the placeholder
  panels (until Phase 4).

If Phase 3 breaks the builder route, the rollback is straightforward:
revert step 5 (BuilderClient's switch to the new hook). The hook
itself can stay — only `MapView` consumes it until step 5 lands.

---

## 8. Risks

1. **Mapbox singleton state.** Mapbox initialisation has historically
   been fragile across re-renders (tearing down / re-mounting the map
   has caused flickers in this codebase — see commit `1e1713db`'s "stop
   tearing down the rooms layer on every parent render"). The new hook
   needs the same care: stable refs, no re-init on parent updates.

2. **`useSceneStore` shape.** The entity index adapter reads through
   the same store the engine writes to. If the store fires too often,
   the index's `subscribe` will fire too often, which the Workbench
   shell will eagerly forward to views. Need to throttle / debounce
   subscribe emissions or use a coarser-grained store selector.

3. **Two Routes, one map**. If a user has `/builder` and `/workbench`
   open in two tabs against the same map, the second tab's Mapbox
   instance might fight the first for the WebGL context. Existing
   builder has had this issue too; not new, but worth a click-through
   before merge.

4. **Server vs client data.** `Map.sceneData` is fetched via SWR. If
   the entity index is computed from `sceneData`, the index re-renders
   every revalidation. `useMemo` keyed on the sceneData reference
   handles this; the SWR cache is shape-stable when nothing changes.

5. **Floor-plan drawer and polygon-draw modes** are stateful
   interactions that today live inside `BuilderClient`'s closure. They
   need to move into the hook, or stay in `BuilderClient` and not be
   available on `/workbench` for v1. Proposal: **stay in BuilderClient
   for v1**, surface them on `/workbench` in Phase 5 as operations.

---

## 9. Open questions

For decision before code starts:

1. **Naming.** `useCampusScene` vs `useCampusEngine` vs `useMapEngine`.
   Proposal: **`useCampusScene`** — it returns a "scene handle" that
   wraps engine + state, not just engine.

2. **Where does the hook live?** Options:
   - `apps/campus/lib/workbench/engine/use-campus-scene.ts` (new
     module, alongside the entity index)
   - `apps/campus/app/hooks/useCampusScene.ts` (next to the existing
     `useMapbox*Layer` hooks)

   Proposal: **the latter** — it's a peer of the existing
   `useMapboxPoiLayer` etc. Keeping all engine hooks in one directory
   is easier to navigate. `lib/workbench/` stays for Workbench-specific
   wiring (the entity index adapter, the View wrappers).

3. **Does `BuilderClient` import from `@/lib/workbench/views/map`,
   or is it fully independent?** Proposal: **fully independent**.
   `MapView` wraps `useCampusScene`; `BuilderClient` consumes
   `useCampusScene` directly. They are *peer consumers* of the same
   hook, not nested.

4. **Should the entity index be a hook (`useCampusEntityIndex`) or
   a plain function?** Proposal: **plain function**. The index is
   recomputed via `useMemo` in `WorkbenchClient` keyed on `sceneData`.
   No hooks needed.

5. **Phase 3 PR strategy: one big PR or five smaller ones?**
   Proposal: **two PRs.**
   - **Phase 3a**: the extracted hook + the entity index adapter
     (steps 1, 2, 5). `BuilderClient` already switches over, so this
     proves the hook is solid. No Workbench changes.
   - **Phase 3b**: the `MapView` real component + the entity index
     wired into `WorkbenchClient` (steps 3, 4). `/workbench` finally
     shows the real scene.

   Splitting this way lets the hook extraction merge on its own merit
   (a refactor with no Workbench dependency) before the View wiring.

---

## 10. Test plan

End-to-end criteria for "Phase 3 done":

- [ ] `/builder` renders identically (no visual regression, all
      interactions still work).
- [ ] `/workbench` shows the real 3D Mapbox scene instead of the
      placeholder text.
- [ ] Clicking a POI in `/workbench`'s 3D view updates the shell's
      selection state (verifiable by adding a temporary debug panel
      that prints `ctx.selection.ids.size`).
- [ ] No engine state leaks between `/builder` and `/workbench` when
      switching between them in the same tab.
- [ ] `pnpm --filter @klorad/campus build` succeeds.
- [ ] The existing `/builder` audit suite (whatever exists) still
      passes.

---

## 11. Next step

If this shape is right, the first concrete change is **Step 1: extract
`useCampusScene`**. That's a refactor with a clear before/after
(`/builder` works identically), so it lands safely and unblocks the
rest.

If the shape is wrong, this doc is what to push back on.
