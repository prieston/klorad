# Klorad Architecture: the monorepo as it is today

Written 22 September 2026, from a full read of `packages/*` and `apps/*` at commit `482379af`. Read only: no code in this repository was changed to produce it. This is ground truth for the "no rewrite" decision (Teo, 21 September): `docs/guides/building-a-klorad-app.md` and any React binding must cite this file for every "compiles today" claim, not assume one.

Every claim below carries a file path, and a line number where the claim is about specific code rather than a whole file's shape. Method: `pnpm install`, `pnpm build:packages` (all 15 packages build clean), then `grep`/`ts-prune`/manual reads across `apps/` and `packages/`; import-graph claims are from `package.json` dependencies plus source-level `grep` for the literal specifier, so a package listed as a dependency with no source import is called out explicitly.

## 1. Package map

Fifteen packages under `packages/*`, six apps under `apps/*` (`website`, `editor`, `admin`, `campus`, `mobility`, `heritage`) plus `apps/mock-inet` (fixture-mode iNET server, not a workspace consumer of anything below). Dependents are read from each package's own `package.json` `dependencies`; a "(string only)" note means the specifier appears in a source file but not as a real import (see §4).

| Package | Public entry | Depended on by (declared) | `dist` after build |
|---|---|---|---|
| `@klorad/api` | `src/index.ts`, `src/react/index.ts` (`./react` sub-export) | none (§4) | 132K |
| `@klorad/config` | 8 sub-exports (`factory`, `panels`, `scene-controls`, `top-bar`, `types`, `utils`, `workbench`) | `apps/editor`, `packages/design-system` | 268K |
| `@klorad/connectors` | `src/index.ts`, `./inet-atms` adapter | `apps/mobility` | 144K |
| `@klorad/core` | `src/index.ts` + `./utils`, `./types`, `./*` wildcard | `apps/editor`, `packages/api`, `packages/engine-three`, `packages/engine-cesium`, `packages/engine-mapbox`, `packages/ion-sdk` | 212K |
| `@klorad/crawler` | `src/index.ts`, `./limits` | `apps/campus` | 56K |
| `@klorad/design-system` | `src/index.ts` (points straight at `src`, no build step) | `apps/website`, `apps/editor`, `apps/admin`, `apps/heritage`, `apps/campus`, `apps/mobility` | n/a (ships source) |
| `@klorad/dev-audits` | `dist/index.js`, CLI bin | CI only (`pnpm audits:*`) | 424K |
| `@klorad/engine-cesium` | `src/index.ts` + `helpers`, `components`, `utils` sub-exports | `apps/editor`, `packages/engine-three` | 844K |
| `@klorad/engine-mapbox` | `src/index.ts` + `components`, `utils` sub-exports | `apps/editor` | 228K |
| `@klorad/engine-three` | `src/index.ts` + `components`, `plugins/*`, `utils`, `viewer` sub-exports | `apps/editor`, `apps/heritage` | 340K |
| `@klorad/ion-sdk` | `src/index.ts`, `src/loader.ts` | `apps/editor`, `packages/engine-cesium` | 3.9M (Cesium ion measurement/sensor bundles) |
| `@klorad/prisma` | `index.ts` (schema owner, no runtime export apps import; see §5) | `apps/mock-inet`, `apps/website`, `apps/editor`, `apps/admin`, `apps/heritage`, `apps/campus`, `apps/mobility` (all as a `prisma generate` dependency) | n/a (ships source, `schema.prisma`) |
| `@klorad/secrets` | `src/index.ts` | `apps/heritage`, `apps/campus`, `apps/mobility` | 20K |
| `@klorad/storage` | `src/index.ts`, `./server`, `./client`, `./types` | `apps/heritage`, `apps/campus`, `apps/mobility` | n/a (ships source) |
| `@klorad/ui` | `dist/index.mjs` + wildcard sub-exports | `apps/editor`, `apps/admin`, `apps/heritage`, `apps/campus`, `apps/mobility`, `packages/engine-mapbox`, `packages/engine-three`, `packages/engine-cesium`, `packages/config` | 716K |

**Notable edges in the dependency graph**: `@klorad/engine-three` depends on `@klorad/engine-cesium` (`packages/engine-three/package.json`, for `CesiumIonTiles`, used at `packages/engine-three/src/Scene.tsx:18,159`), a renderer package depending on a sibling renderer package, not on an abstraction. No package imports from an app (verified by grep for `@klorad/{campus,mobility,heritage,editor,admin}` under `packages/`: no hits); that boundary holds. `@klorad/api` has zero package or app dependents; nothing in `packages/*` or `apps/*` depends on it.

## 2. `@klorad/core` as it is

`packages/core/src/index.ts` re-exports `types`, `state`, `utils`, `services`, `hooks`, `routing`, and the logger. It is not a single store; it is five independent zustand stores plus one plain class:

- **`useSceneStore`** (`packages/core/src/state/useSceneStore.ts`, 175 lines) is the scene model: `objects`, `observationPoints`, camera/view state, Cesium fields (`cesiumViewer`, `cesiumInstance`, `cesiumIonAssets`, ...), Mapbox fields (`mapboxMap`, `mapboxSceneData`, ...), and their setters, composed from four action slices under `state/scene-store/`: `object-actions.ts` (153 lines), `observation-actions.ts` (136 lines), `cesium-actions.ts` (266 lines, e.g. `setCesiumViewer`, `setBasemapType` at lines 8-9), `mapbox-actions.ts` (62 lines). `cesium-actions.ts` and `mapbox-actions.ts` hold live viewer/map handles typed `any`/`unknown` (`packages/core/src/state/scene-store/cesium-actions.ts:8-9`) rather than importing `cesium`/`mapbox-gl` types, so the store is not literally coupled to those packages at the type level, only at the shape level (it knows there is a viewer, not what it renders).
- **`useWorldStore`** (`packages/core/src/state/useWorldStore.ts`, 17 lines) holds `activeWorld: World | null` and derives `engine` from it. `World.sceneData` is typed `any` (`packages/core/src/types/world.ts:7`, no comment justifying it per the root `CLAUDE.md` rule).
- **`useIoTStore`** (`packages/core/src/state/iot-store.ts`) is kept separate from `useSceneStore` on purpose (`packages/api/src/extensions/digital-twin.ts:70`: "IoT data lives in the separate `useIoTStore` to avoid re-renders").
- **`useXRStore`** (`packages/core/src/state/xr-store/xr-store.ts`, 67 lines), consumed only by `packages/engine-three/src/components/XR/*`.
- **`IoTService`** (`packages/core/src/services/IoTService.ts`) is a plain class, not a store; it polls `useSceneStore` for objects with `iotProperties` on a 5-second interval (`checkForIoTUpdates`, line 34) and writes into `useIoTStore`.

**React and renderer imports.** Exactly one file imports `react`: `packages/core/src/hooks/useTenant.ts` (a `"use client"` hostname-to-tenant lookup, lines 1-3). Five files import `three` directly: `utils/coordinateUtils.ts:2`, `state/xr-store/xr-store.ts:2`, `state/scene-store/{helpers,model-helpers,types}.ts` (each line 1-2, `import * as THREE from "three"`). No file imports `cesium` or `mapbox-gl` packages. So `@klorad/core` is close to, but not, the "framework-free" World layer `docs/WORLD-MODEL.md` calls for: it is React-free everywhere except the tenant hook, but it is not renderer-free, because five files hold a compile-time dependency on `three` for vector/quaternion math and XR state.

**Where world state actually lives at runtime**: in these zustand stores, in the browser, per open tab. There is no server-side or persisted representation of "the world" as the thesis defines it; `Project.sceneData` in Postgres (via `@klorad/prisma`) is a serialised snapshot apps read into `useSceneStore` on load and write back on save (see `SceneAPI.load`/`.export`, §4), not a live world.

`packages/core/src/routing/find-path.ts` (297 lines, an A* graph search over `RouteNode`/`RouteEdge`) is exported from `core/src/routing/index.ts` but has zero consumers anywhere in `apps/` or `packages/` other than its own package (§7).

## 3. Engines: API to renderer, file by file

All three engines bypass `@klorad/api` entirely and read/write `@klorad/core`'s stores directly. There is no "the API asks the engine to render X" call chain anywhere in the repository; there is "the engine subscribes to the store and the app decides which engine component to mount."

**three.js** (`packages/engine-three`): `Scene.tsx` (216 lines) is the entry. It calls `useSceneStore` once with a combined selector (line 63, comment "reduce subscriptions from 17 to 1") for `objects`, `observationPoints`, `selectedObject`, environment flags, and their setters, then renders `<Canvas>` from `@react-three/fiber` with child components (`SceneObjects`, `SceneObservationPoints`, `SceneTransformControls`, `SceneLights`, `GroundPlane`, `CesiumIonTiles` from the sibling Cesium package) that each read/write the same store. It understands `position`/`rotation`/`scale` (Space, informally, no explicit Coordinate System object) and `previewMode`/`playbackSpeed` (a thin Time), nothing of Physical correspondence (no Digital Object/Shadow/Twin branch in `SceneObjects`) and nothing of Actions/Entitlements/Behaviours.

**Cesium** (`packages/engine-cesium`): `CesiumViewer.tsx` (70 lines) composes four hooks, `useCesiumInitialization`, `useCesiumEntities`, `useCesiumStyling`, `useCesiumBasemap`, each importing `useWorldStore`/`useSceneStore` from `@klorad/core` directly (`packages/engine-cesium/src/hooks/useCesiumEntities.ts:6,20-21`: `const world = useWorldStore((s) => s.activeWorld); const objects = useSceneStore((s) => s.objects);`). It understands `GeoPosition`-shaped positions and ion assets; no correspondence or interaction concepts.

**Mapbox** (`packages/engine-mapbox`): `MapboxViewer.tsx` (57 lines) delegates to `useMapboxInitialization`, which imports `useSceneStore` directly (`packages/engine-mapbox/src/hooks/useMapboxInitialization.ts:5`) reads `mapboxSceneData`/`previewMode` (lines 20-22) and writes the live `mapbox-gl` map instance back into the store via `setMapboxMap` (line 20) and imperative `m.setCenter/setZoom/setPitch/setBearing` calls (lines 131-134) on it. `mapboxSceneData` (`packages/core/src/types/mapbox-scene.ts`) is Mapbox's own scene-shape (rooms, nav nodes, walls, floor plan rasters) parallel to, not unified with, `useSceneStore.objects`.

**Editor's wiring is the concrete example**: `apps/editor/app/components/Builder/Scene/SceneCanvas.tsx:1-26` dynamically imports `Scene` from `@klorad/engine-three`, `CesiumViewer`/`CesiumObjectTransformEditor` from `@klorad/engine-cesium`, and `MapboxViewer` from `@klorad/engine-mapbox`, and itself imports `useWorldStore`/`useSceneStore` from `@klorad/core` (line 6) to pick which one to mount. `@klorad/api` does not appear in this file, or anywhere else in `apps/editor`.

## 4. `@klorad/api`: every export and what it actually reaches

`packages/api/src/index.ts` (4 lines) exports `createSceneAPI` plus all types from `types/`, `types/interfaces`, `types/campus`. `src/react/index.ts` is a separate `./react` sub-export.

| Export | Layer (per `docs/WORLD-MODEL.md`) | Reaches |
|---|---|---|
| `createSceneAPI(engine, mode)` (`impl/scene.ts:130`) | World (`SceneAPI`) | `useSceneStore` in core, directly (`impl/scene.ts:1,18,66`) |
| `camera`, `objects`, `tour`, `assets`, `environment` sub-APIs (`impl/{camera,objects,tour,assets,environment}.ts`) | World / not-yet-homed surfaces (`docs/WORLD-MODEL.md` "Surfaces present today") | `useSceneStore`, no engine or Prisma import in any of these five files |
| `events` (`impl/events.ts`, 22 lines) | World | in-memory `Map`-based emitter, no store |
| `sensors`, `iot` (`extensions/digital-twin.ts`) | Physical correspondence (Digital Shadow, partial per `docs/WORLD-MODEL.md`) | `useSceneStore.updateObjectProperty`; `IoTAPI.getData` **always returns `null`** (`extensions/digital-twin.ts:69-72`), matching `docs/WORLD-MODEL.md`'s own "partial (stub read path)" line for Digital Shadow |
| `exhibits` (`extensions/museum.ts`) | app-only surface, museum vertical | `useSceneStore` |
| campus extension: POIs, layers, floor plans, rooms, nav nodes (`extensions/campus.ts`, 485 lines) | `@klorad/api/campus` per `docs/WORLD-MODEL.md` | `useSceneStore` |
| `useObjects`, `useSelectedObject`, `useTour`, `useSceneEvent` (`react/index.ts`) | not in `docs/WORLD-MODEL.md`; a thin React read layer over the same store | `useSceneStore` directly (line 4), **not** through `createSceneAPI` |

No file in `packages/api/src` imports Prisma, and none imports an engine package; every implementation file goes straight to `@klorad/core`'s store. So the "does it go through core, straight to an engine, or straight to Prisma" question in the spec has one answer for the whole package: straight to core, always.

**`createSceneAPI` is never called at runtime anywhere in this repository.** `grep -rn "createSceneAPI"` across `apps/` and `packages/` returns only its own definition/export and one hit in `apps/website/app/platform/page.tsx:95,98`, inside a template-literal string (`codeSample`) rendered as marketing copy, never executed. That sample also calls `createSceneAPI({ engine: "cesium" })`, an object argument; the real signature is `createSceneAPI(engine: Engine, mode: SceneMode)`, two positional arguments (`impl/scene.ts:130`). **CONTRADICTION**: `docs/WORLD-MODEL.md`'s World layer table calls `SceneAPI` "live (as an editor-shaped store)" and the homepage claims (`docs/website-homepage-draft.md`, referenced by `docs/PLAN.md`) rest on the SDK being usable; the code compiles and the function would work if called, but nothing in the product calls it, and the one place that shows it to a reader shows a call that would not typecheck against the real signature.

Building the package also surfaces one real defect: `dist/react/index.js (1:0): Module level directives cause errors when bundled, "use client" in "dist/react/index.js" was ignored` (tsup build output, `packages/api/src/react/index.ts:1`). If an app imported `@klorad/api/react` today inside a Next.js Server Component boundary, the directive that is supposed to prevent that would be silently stripped.

## 5. Apps: which entry points, and where they bypass the public API

Per app, the packages it imports from `@klorad/*` for rendering/world purposes (not `@klorad/ui`/`@klorad/design-system`, which are presentational and out of scope for "world state"):

| App | `@klorad/api` | `@klorad/core` | Engine packages | Own rendering | World state actually lives in |
|---|---|---|---|---|---|
| `editor` | 0 imports | 41 files (`grep -rl "@klorad/core" apps/editor`) | `engine-three`, `engine-cesium`, `engine-mapbox`, `ion-sdk` (all declared + imported) | none | `@klorad/core` stores, serialised to `Project.sceneData` |
| `heritage` | 0 imports | 0 direct imports (only via `engine-three`'s own dependency on core) | `engine-three`, 2 files (`lib/heritage/ui/ViewerCanvas.tsx`, `.../ProxyAuthoring.tsx`) | none | `engine-three`'s components (i.e. `@klorad/core` transitively), plus Heritage's own Prisma tables for venue/proxy metadata |
| `campus` | 0 imports | 0 imports | none declared, none imported | raw `mapbox-gl`, 2 files | Campus's own Prisma tables (POIs, layers) plus `Project.sceneData.campus`; no Scene Object/Shadow/Twin concept touches this app at all |
| `mobility` | 0 imports | 0 imports | none declared, none imported | raw `mapbox-gl`, 6 files, plus `three` as a direct dependency (not through `engine-three`) | Mobility's own Prisma tables (`MobilityDevice`, alert rules, etc.) plus `@klorad/connectors`; already has its own audit item on the board (import report, due 3 October), this row does not replace it |
| `admin` | 0 imports | 0 imports | none | none | operator console only; no world-state surface |
| `website` | 1 string literal, not executed (§4) | 0 | 0 | none | none; marketing/docs only |

So the "bypass" count the spec asks for is, today, total: not one app builds a scene through `@klorad/api`. Editor and Heritage bypass it by going straight to the store the API itself wraps; Campus and Mobility bypass it more completely, by not depending on any Klorad rendering package at all and building their own `mapbox-gl` integration from scratch, parallel to `@klorad/engine-mapbox` rather than on top of it. `@klorad/engine-mapbox` (228K built, editor-only) and Campus/Mobility's own `mapbox-gl` code are two independent Mapbox integrations in this monorepo today.

No app queries Prisma without going through its own `lib/prisma.ts` wrapper around `@prisma/client` (`apps/mobility/lib/prisma.ts`, `apps/{heritage,campus,editor,admin}/lib/prisma.ts` equivalents); `@klorad/prisma`'s only runtime role is owning `schema.prisma` and running `prisma generate` in `postinstall` (`packages/prisma/package.json` scripts), not a package apps import at runtime. That split (schema package vs. generated-client wrapper per app) is consistent with `docs/CLAUDE.md`'s tenancy rules and is not itself a bypass.

## 6. Verdict: can a thin React binding be written today without rewriting core or the engines?

**Yes, partially, today**, for the read side of the object/tour model, **and no for everything else**, without changes to `@klorad/core` or an engine. Specifically:

- `packages/api/src/react/index.ts` already **is** most of a thin binding: `useObjects`, `useSelectedObject`, `useTour` read `useSceneStore` reactively and shape it into `@klorad/api`'s public types (`SceneObject`, `TourStop`). `useSceneEvent` subscribes to `SceneEventBusAPI`. This is close in spirit to the target hooks the building-guide item names (`useScene`, `useSceneObject`, `useShadow`), just under different names, unwired to any Provider, and unused by any app. **What already exists in core that is effectively this binding under another name**: nothing further, `@klorad/core` itself exposes no React binding beyond the raw zustand hooks (`useSceneStore`, `useWorldStore`), which is exactly what `api/react` wraps.
- `KloradProvider`, `Scene` (as a JSX component, not `engine-three`'s `Scene`), `SceneObject`, `Connector` do not exist anywhere. Building them needs no core or engine change: a `KloradProvider` can call `createSceneAPI` and put it in React context; `Scene`/`SceneObject` components can be written as thin wrappers that call `objects.add`/`objects.update`/`objects.remove` from that context API, which already exist and already work (`ObjectsAPI`, `packages/api/src/impl/objects.ts`). This is new code in a new `@klorad/react` package, not a change to `core` or an engine.
- `useSceneObject` (single object by id, reactive) does not exist; it is a small addition to `api/react` (a selector keyed by id over the existing store), not a core change.
- `useShadow(id)` **cannot** be written honestly today without a core or API change, because there is no timestamped-observation model to subscribe to: `IoTAPI.getData` returns `null` unconditionally (§4) and `useIoTStore` is untimestamped key-value weather/sensor state, not an ordered observation stream. This is exactly the kernel step 3 gap `docs/WORLD-MODEL.md`'s build order already names; the guide should mark it TARGET, and the smallest fix is in `@klorad/api` (`getData` reading `useIoTStore` and returning its last value, at minimum), not a new package.
- `useAction` cannot be written at all: no Action/Entitlement/Behaviour exists in `@klorad/core` or `@klorad/api` in any form (`docs/WORLD-MODEL.md` marks all three "absent" or "app-only"). This is Phase 2 per `docs/PLAN.md` and needs the kernel step 4 work, not a binding-package addition.
- The binding would sit over `@klorad/api`, which itself sits over `@klorad/core`'s store. Nothing stops a `@klorad/react` package from working today for the object/tour surface; it inherits every gap `@klorad/api` already has (§4) rather than adding new ones. It would also, for the first time, give `@klorad/api` a real consumer.

**Ranked list of what must change for a complete binding** (smallest first): (1) write `@klorad/react` itself: a new package, no core/engine change, covers `objects`/`tour`; (2) `IoTAPI.getData`: change one function body in `@klorad/api` to read `useIoTStore` instead of returning `null`, enough for a non-timestamped `useShadow`; (3) an observation model with timestamps/ordering in `@klorad/core` or `@klorad/api` (kernel step 2, already planned) for a thesis-honest `useShadow`; (4) Action/Entitlement/Behaviour (kernel step 4, already planned, Phase 2) for `useAction`.

## 7. Kill list

Files or exports with zero consumers outside their own package (`ts-prune` per-package plus a cross-repo `grep` for each flagged symbol, since `ts-prune` alone only sees within-package usage and flags every public export of a library entry point as a false positive):

| File | Export | Evidence |
|---|---|---|
| `packages/core/src/routing/find-path.ts` (297 lines) + `packages/core/src/routing/index.ts` | `findPath`, `RouteNode`, `RouteEdge`, `RouteGraph`, `RoutePath`, `FindPathOptions`, `CostFn`, `EdgeFilter`, `NodeFilter` | `grep -rn "findPath"` outside `packages/core/src/routing/`: no hits in `apps/` or `packages/` |
| `packages/core/src/hooks/useTenant.ts:71` | `getTenantFromHostname` | only re-exported at `hooks/index.ts:71`; no caller anywhere |
| `packages/api` (whole package, 1,941 lines across `src/`) | `createSceneAPI` and everything built on it | zero runtime callers anywhere (§4); not literally dead code (it is the intended v0.1 SDK surface, per `docs/PLAN.md`), but zero of it is exercised by a build, a test, or an app today |

Not included: `ts-prune`'s raw output for `packages/api`, `packages/core`, and every other package's own `index.ts`, which flags dozens of type and function exports (e.g. `CameraAPI`, `TourAPI`, `MapboxNavNode`, `PanelConfiguration`) as unused. Those are each package's intended public surface, consumed by whatever eventually imports the package; flagging them as dead code the way `ts-prune` does by default would mean treating every unpublished library as 100% dead code, which is not a useful signal here. The two `core` routing/tenant items above are different: they are not part of any documented public surface (`docs/WORLD-MODEL.md` does not mention pathfinding or tenant-by-hostname) and have no consumer even inside the monorepo that declares them a dependency.
