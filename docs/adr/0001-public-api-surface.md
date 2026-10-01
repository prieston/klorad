# ADR-0001: Public API surface

Status: Proposed, NEEDS TEO APPROVAL
Date: 2026-10-01
Drafted by: nightly-build agent, from `docs/WORLD-MODEL.md`, `docs/ARCHITECTURE.md` and
`docs/platform-inventory.md`

## Why this ADR

`docs/PLAN.md` calls ADR-0001 the decision that fixes `@klorad/api`'s shape before Phase 1's
reorganisation work (due 15 October) and before npm publish. `@klorad/api` has zero runtime
callers anywhere in the repository today (`docs/ARCHITECTURE.md` section 4), so every choice
below is cheap to make now and expensive to unmake once an external builder depends on it
(`docs/PLAN.md` Phase 2). Each question below gets one "Decision:" line for Teo; nothing here is
implemented by this PR.

## 1. The three sub-exports: `@klorad/api/world`, `/access`, `/integration`

Today `packages/api/src/index.ts` is one flat export: all of `types/`, `types/interfaces`,
`types/campus`, plus `createSceneAPI`. Reading the layer column of `docs/platform-inventory.md`,
World already has real content in the package (`SceneAPI`, `ObjectsAPI`, `GeoPosition`,
`EnvironmentAPI`, `SensorsAPI`/`IoTAPI`, `SceneEventBusAPI`). Integration already has real content
too (`POIManagerAPI`/`LayersAPI` in the campus extension, `IoTAPI`, and the separate
`@klorad/connectors` package). Access has nothing live inside `@klorad/api`: every Access-layer row
in `docs/platform-inventory.md` is "app-only" or "partial" and lives in Prisma and NextAuth, in
the apps, not in the package.

Options:
- (a) Three literal subpath exports now, moving today's flat exports into them, with the flat
  `index.ts` kept as a deprecated re-export for one minor version.
- (b) No code split, document the three layers conceptually only, since Access has nothing to
  export yet.
- (c) Split `world` and `integration` now, defer `access` until an Access class (first candidate:
  Entitlement, Phase 2 kernel step 4) actually lands in the package.

Recommendation: (c). An `access` subpath with nothing behind it is a surface with no thesis class
to back it, which the root `CLAUDE.md` rule ("no public export without a thesis class or an ADR
behind it") argues against. Ship `world` and `integration` for the 15 October reorganisation;
add `access` when Entitlement ships.

Decision:

## 2. Engines reading `@klorad/core` stores directly

`docs/ARCHITECTURE.md` section 3: all three engines bypass `@klorad/api` entirely and read and
write `@klorad/core`'s zustand stores directly; there is no "the API asks the engine to render X"
call chain anywhere in the repository, only "the engine subscribes to the store and the app
decides which engine component to mount." `docs/WORLD-MODEL.md`'s own layer rules already frame
this as deliberate: "rendering responsibilities that the thesis places conceptually inside the
World layer are fulfilled by renderer adapters implementing World contracts."

Options:
- (a) Keep it: state explicitly that the root `CLAUDE.md` rule "apps must not bypass the public
  API to manipulate world state" binds apps (`SceneCanvas.tsx`-style app code), not the three
  renderer packages, which are the sanctioned implementation of the World contract.
- (b) Require engines to go through `@klorad/api` too, so an engine package reads world state only
  via `createSceneAPI`, the same as any app. This closes the ambiguity but is a real rewrite of
  three engine packages with no board item funding it today.

Recommendation: (a), matching `docs/WORLD-MODEL.md`'s existing "renderers implement it" framing.
Write it into the ADR text as a clarification of an existing rule, not a new one, so the next
agent reading `CLAUDE.md` does not flag engine-core imports as a bypass bug.

Decision:

## 3. The React binding: `@klorad/react` or `@klorad/api/react` (OPEN, Teo has not decided)

`packages/api/src/react/index.ts` already exports `useObjects`, `useSelectedObject`, `useTour`,
`useSceneEvent`, reading `useSceneStore` directly rather than through `createSceneAPI`
(`docs/ARCHITECTURE.md` section 4, last row of the exports table). Section 6 of the same document
concludes that `KloradProvider`, `Scene`, `SceneObject`, `Connector` can all be built today with no
core or engine change, as new code over the existing hooks. Building the package also surfaces a
real defect: `dist/react/index.js`'s `"use client"` directive is dropped when bundled (tsup
warning, `docs/ARCHITECTURE.md` section 4), so a Server Component boundary would silently lose the
protection that directive is supposed to give.

Options:
- (a) New package `@klorad/react`. Keeps World's "no React" rule a package-level boundary, not just
  a subpath convention; costs one more package to version, build and publish.
- (b) Keep `@klorad/api/react`. Less churn, versions the binding with World together; the "no
  React in World" framing then rests entirely on the subpath split holding, which it does today
  but is one `grep` away from drifting unnoticed.

This question is open. Present both to Teo without a recommended default; whichever is chosen, fix
the `"use client"` bundling defect as part of the same change.

Decision:

## 4. Homes for surfaces not in the thesis diagram

`docs/WORLD-MODEL.md`'s own "Surfaces present today that are not in the diagram" table already
proposes a home for each one, reviewed once already (this board item's own update history cites
`docs/ARCHITECTURE.md`). Adopting it as-is:

| Surface | Proposed home | Why |
|---|---|---|
| `AssetsAPI` (Cesium ion) | `@klorad/engine-cesium` | Vendor infrastructure; World should not know ion. |
| `EnvironmentAPI` | Dismantled: basemap/skybox to engine, lighting to Scene Object state, simulation time to Time Spectrum | Four concepts under one name today. |
| `TourAPI` | Experience extension (`@klorad/api/experiences` or similar) | Orchestrates camera, timing, entitlements; not an Animation, not museum-only. |
| `ExhibitsAPI` | Vertical extension `@klorad/api/museum` | Cultural heritage semantics referencing Scene Objects. |
| `RoomsAPI`, `FloorPlansAPI` | Stay in `@klorad/api/campus` for v0.1 | Generalisation to `SpatialRegion` waits for a second vertical that needs it. |
| `NavNodesAPI` | Navigation extension (`@klorad/api/navigation`) | A computational graph over world space, not a Scene Object subtype. |
| `POIManagerAPI`, `LayersAPI` | Integration, Location-Based Services | Already in the diagram; kept where they are. |

Decision:

## 5. The select event and other Interaction-pillar events for v0.1

`SceneEventMap` (`packages/api/src/types/index.ts:110-121`) already types `object:select`,
`object:deselect`, `object:add`, `object:remove`, `object:move`, `tour:start`, `tour:stop`,
`tour:change`, `scene:change`, `scene:save`. A repository-wide `grep` for `events.emit` finds
exactly one call site in the whole package, `scene:change` in `impl/scene.ts:110`; every other
event in the map is typed but never emitted. `ObjectsAPI.select` (`impl/objects.ts:45`) calls the
store's `selectObject` directly and never touches the event bus. The website's marketing sample
calls `world.events.on("select", inspect)`, which does not match any key in `SceneEventType` even
once the bus is wired (`docs/platform-inventory.md`, homepage claims table).

Options:
- (a) Wire `object:select`, `object:deselect`, `object:add`, `object:remove`, `object:move` from
  `ObjectsAPI`'s existing mutators now. No new types, the Interaction pillar's simplest case
  (selection has no Action/Entitlement chain to check), zero scope creep.
- (b) Leave them unwired until kernel step 4 (Action, Entitlement, Behaviour) lands, treating
  selection as an Access/Interactable concern rather than an Interaction-pillar event yet.

Recommendation: (a) for the five object events; `tour:*` wiring waits on question 4's TourAPI home.
Fix the website sample's event key regardless of which option is chosen; it does not compile
against the real types today.

Decision:

## 6. Deferred surfaces and how "deferred" is expressed in the package

`docs/PLAN.md`'s Phase 1 "Deferred" list includes XR, but `@klorad/engine-three`'s default entry
already exports it: `src/index.ts` to `./components` to `XRWrapper`
(`packages/engine-three/src/index.ts`, `packages/engine-three/src/components/index.ts:10`), and
the package's `peerDependencies` list `@react-three/xr` unconditionally
(`packages/engine-three/package.json`). Installing `@klorad/engine-three` pulls those peers
whether or not XR is "deferred" in the plan. The same npm publish blocker board item
(3241122490) already flags the adjacent problem that the default entry also pulls
`@klorad/engine-cesium`, MUI and `aws-sdk`.

Options:
- (a) Subpath export `@klorad/engine-three/xr`; the default entry drops the XR import and its
  peers. "Deferred" then means "not bundled by default" as well as "not documented."
- (b) XR stays in the default entry; "deferred" means "not documented or promoted" only, bundled
  either way.

Recommendation: (a). Apply the same subpath-not-default-entry pattern to every deferred surface in
`docs/PLAN.md`'s list (rooms, floor plans, tour) before npm publish, as the source issue (#295)
already asks.

Decision:

## 7. Semver and deprecation policy for 0.x

`docs/PLAN.md`: "2026 is a stabilization year... every surface published will be carried for
years." The root `CLAUDE.md` already states the mechanism, "breaking changes need a deprecation
note and a migration line in the docs," but not when it starts to apply pre-1.0.

Options:
- (a) Standard 0.x semver (0.MINOR.PATCH, a MINOR bump may break), with a deprecation note and
  migration line required from the first breaking change onward, same mechanism as 1.0 and later.
- (b) A looser pre-1.0 convention: breaking changes allowed without a deprecation note until 1.0,
  the stricter mechanism starting only at 1.0.

Recommendation: (a). `@klorad/api` has no runtime callers today, so this costs nothing yet; once
Phase 2's first external builder exists, every undocumented break costs them, and the discipline
is cheaper to start before that than after.

Decision:

## 8. npm publish blockers

Tracked on the board, not re-derived here: item 3241122490 (gate "Needs my approval") is the
dependency-and-peer audit, `@klorad/engine-three` depends on `@klorad/engine-cesium` rather than
treating it as optional, and pulls MUI and `aws-sdk` peers that belong to apps or `@klorad/ui`.
This ADR's role is only to confirm it is item 1 of `docs/DEBT.md` once that file is written, per
the board item's own closing line, not to re-scope it.

Decision: informational, no Teo decision needed in this ADR.

## Appendix: TARGET blocks in `docs/guides/building-a-klorad-app.md` (PR #309), mapped to the
questions above

| Guide section | TARGET block | Maps to |
|---|---|---|
| 3 | `createSceneAPI`'s third `coordinateSystem` argument | Question 1 (World sub-export), question 7 (new export needs the semver policy) |
| 4 | `correspondence` field on `SceneObject` | Out of this ADR's scope; tracked on its own board item (3241121059), which the item's own spec says needs no ADR because it is a named thesis class |
| 5 | `twinScene.iot.getData` returning a real, timestamped reading | Question 1 (Shadow stays a World class); the observation model itself is kernel step 2, already on `docs/PLAN.md`, not a new ADR-0001 decision |
| 6 | `MapboxViewer` rendering `useSceneStore.objects` | Question 2 (engine execution); an engine-internal change, no new public export |
| 6 | `KloradProvider`, `Scene`, `SceneObject` from `@klorad/react` | Question 3 |
| 7 | `useAction` from `@klorad/react` | Question 1 (which sub-export an Action/Entitlement surface would live in, once it exists); deferred to kernel step 4, Phase 2, not decided now |
