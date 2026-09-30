# ADR-0001: Public API surface (World, Access, Integration)

Status: Proposed. NEEDS TEO APPROVAL, every question below is Teo's decision, not the agent's.
Date: 30 September 2026 (drafted).
Decision date: due 30 September 2026 per `docs/PLAN.md`; the item was promoted to the top of the
board queue on 30 September itself, so the decision date moves to 7 October 2026.

## Purpose and sources

`@klorad/api` (`packages/api`, 1,941 lines) is the intended public SDK surface for the platform
described in root `CLAUDE.md` and `docs/PLAN.md`. `docs/WORLD-MODEL.md` maps that surface to the
three layers of Teo's thesis (World, Access, Integration) and proposes layer rules "to be
confirmed in ADR-0001". This document turns that proposal into eight concrete questions, drawn
from `docs/WORLD-MODEL.md` itself, `docs/ARCHITECTURE.md` (a read-only pass over the monorepo as
it stood on 22 September 2026), `docs/platform-inventory.md` (a coverage check of every thesis
class against the code, PR #311), and `docs/guides/building-a-klorad-app.md` (a quickstart guide
with TARGET blocks proposing exactly the changes this ADR would authorise, PR #309). The latter
two are not yet merged to `main` at the time of this draft; their content is read from their open
branches and cited by commit, not assumed stable until they land.

Two findings from `docs/ARCHITECTURE.md` frame every question below. First, `createSceneAPI` has
zero runtime callers anywhere in the repository: the only other hit for the name is a string
inside a marketing template literal in `apps/website/app/platform/page.tsx` that never executes
(`docs/ARCHITECTURE.md` section 4). Second, all three renderers bypass `@klorad/api` and read and
write `@klorad/core`'s stores directly (`docs/ARCHITECTURE.md` section 3). So this ADR is not
adjusting a surface real code depends on; it is naming the surface before the first real
dependency exists, which is exactly what `docs/PLAN.md`'s "2026 is a stabilization year" language
asks for: decide before code and docs depend on the wrong shape, not after.

## Question 1: three sub-exports, and which of today's exports go where

**Context.** `packages/api/src/index.ts` (4 lines) is a single flat entry point exporting
`createSceneAPI` plus every type, with a separate `./react` sub-export
(`packages/api/package.json`'s `exports` field). `docs/WORLD-MODEL.md` names three layers, World,
Access and Integration. `docs/platform-inventory.md` already sorts every thesis class into one of
three tables under those names. Read against that sort: World would hold `createSceneAPI`,
`camera`, `objects`, `events`, and the Physical correspondence surfaces (`sensors`, `iot` from
`extensions/digital-twin.ts`). Integration would hold the Location-Based Services surfaces
(`POIManagerAPI`, `LayersAPI` from `extensions/campus.ts`) and, arguably, `iot` a second time,
since `docs/platform-inventory.md`'s Integration table also lists "IoT Devices" as its own row,
pointing at the same file. Access is the problem case: every Access-layer thesis class is marked
app-only, partial or absent in `docs/platform-inventory.md`, and none of it lives in
`packages/api` today. A literal `@klorad/api/access` subpath would ship empty on day one.

**Options.**
- A. Three literal subpath exports (`@klorad/api/world`, `/access`, `/integration`), each with its
  own `dist` entry, plus a root re-export for compatibility.
- B. Keep one flat entry point, but organise the source tree into `src/world`, `src/access`,
  `src/integration` directories and document the layer per export in the README, without a
  subpath split.
- C. Ship two subpaths now, `@klorad/api/world` and `@klorad/api/integration`, where there is real
  content, and defer `@klorad/api/access` until an Access-layer surface actually exists inside
  `packages/api`.

**Recommendation.** C. Publishing an empty `@klorad/api/access` subpath the day it ships
contradicts the "honesty over polish" rule in root `CLAUDE.md`: a subpath a developer can import
that resolves to nothing useful is worse than no subpath at all. World and Integration both have
real content to move today; Access does not.

Decision: ___________________________________________________

## Question 2: do engines execute against `@klorad/api`, or against `@klorad/core` directly

**Context.** `docs/WORLD-MODEL.md`'s proposed rule reads "World owns meaning, engines own
execution... renderers implement World contracts." `docs/ARCHITECTURE.md` section 3 finds the
opposite in the code: all three engines subscribe to `@klorad/core`'s zustand stores directly.
`packages/engine-three/src/Scene.tsx:63` reads a combined `useSceneStore` selector.
`packages/engine-cesium/src/hooks/useCesiumEntities.ts:6,20-21` imports `useWorldStore` and
`useSceneStore` from `@klorad/core` by name. `packages/engine-mapbox/src/hooks/
useMapboxInitialization.ts:5,20,131-134` reads `mapboxSceneData` and writes the live `mapbox-gl`
instance back into the store. `apps/editor/app/components/Builder/Scene/SceneCanvas.tsx` picks
which engine to mount by reading `useWorldStore`/`useSceneStore` itself and never imports
`@klorad/api`. Root `CLAUDE.md`'s rule, "apps must not bypass the public API to manipulate world
state", names apps. It does not say whether an engine counts as an app for this purpose, and today
no engine goes through `@klorad/api` at all, so read literally the rule does not currently bind
engines either way.

**Options.**
- A. Ratify today's shape: engines are execution adapters over `@klorad/core`'s store, not over
  `@klorad/api`; the "apps must not bypass" rule binds apps only. `docs/WORLD-MODEL.md`'s
  "renderers implement World contracts" line is corrected to describe what exists, renderers
  consume the World store, not a `@klorad/api`-defined contract.
- B. Hold engines to the promissory note as written: renderers must eventually consume
  `@klorad/api`-defined contracts, not `@klorad/core` internals directly. This is new, unscheduled
  work across all three engine packages, with no PR or due date proposed anywhere today.

**Recommendation.** A, for Phase 1. Nothing already committed on `docs/PLAN.md` changes this shape
before 31 October at the earliest (the `@klorad/core` split "may slip into Phase 2 depending on
the debt audit"), and leaving `docs/WORLD-MODEL.md` asserting a contract that does not exist
misstates the code to the next reader. B can still be the longer-term direction; it just is not a
Phase 1 decision with a scoped PR behind it yet.

Decision: ___________________________________________________

## Question 3: the React binding, `@klorad/api/react` or a new `@klorad/react` package

**Context.** `packages/api/src/react/index.ts` (118 lines) already implements `useObjects`,
`useSelectedObject`, `useTour` and `useSceneEvent`, each reading `useSceneStore` reactively and
shaping it into `@klorad/api`'s public types. It has zero callers anywhere in the repository
(`docs/ARCHITECTURE.md` section 6) and no `Provider`. `KloradProvider`, a JSX `Scene`,
`SceneObject` and `Connector` do not exist under any name. Building them needs no `@klorad/core` or
engine change: a `KloradProvider` can call `createSceneAPI` and put it in context, and `Scene`/
`SceneObject` can wrap `ObjectsAPI.add`/`.update`/`.remove`, which already work
(`docs/ARCHITECTURE.md` section 6, `docs/guides/building-a-klorad-app.md` section 6). Building it
also surfaces a real defect regardless of which package it lands in: `dist/react/index.js` loses
its `"use client"` directive when bundled (`packages/api/src/react/index.ts:1`, a `tsup` warning),
so this sub-export is not safe at a Next.js Server Component boundary today.

**Options.**
- A. Extend the existing `./react` sub-export in place, adding `KloradProvider`/`Scene`/
  `SceneObject`/`Connector` to `packages/api/src/react/index.ts` and fixing the bundling defect
  there. No new package, no new dependency. `react/index.ts` is already the largest single file in
  this binding; growing it further means splitting it into `react/*.ts` files to keep each under
  root `CLAUDE.md`'s file-size guidance, itself a small refactor.
- B. Spin `@klorad/react` out as its own package. A clean, growable home separate from
  `packages/api`'s own React-free intent for the rest of the package, at the cost of a second
  package whose entire initial content already compiles today inside `api/react`.

**Recommendation.** None. This is the one question of the eight that is genuinely open: both
options are reasonable, both are cheap, and the choice is about package shape and future growth
room, not about anything the code forces. Present both to Teo without a lean, per the item's own
instruction.

Decision: ___________________________________________________

## Question 4: homes for surfaces not in the thesis diagram

**Context.** `TourAPI`, `AssetsAPI`, `EnvironmentAPI`, `ExhibitsAPI`, `FloorPlansAPI`, `RoomsAPI`
and `NavNodesAPI`/`NavEdgesAPI` all exist in `packages/api` today with no box in the thesis
diagram. `docs/WORLD-MODEL.md`'s "Surfaces present today that are not in the diagram" table
already proposes a home for each, written after the 17 September review pass, and
`docs/platform-inventory.md` independently re-derives the same list from the real exports and
finds no drift (its own "`@klorad/api` exports with no home in the diagram" section).

**Options.**
- A. Ratify `docs/WORLD-MODEL.md`'s table as ADR text: `AssetsAPI` to `@klorad/engine-cesium`
  (vendor infrastructure, Cesium ion specifically); `EnvironmentAPI` dismantled across engine
  concerns (basemap, skybox), Scene Object state (lighting) and Time Spectrum (simulation time),
  since it bundles four unrelated concepts under one interface
  (`packages/api/src/impl/environment.ts`); `TourAPI` to an optional experience extension, not
  Animation, since it orchestrates camera and timing with no Behaviour dependency; `ExhibitsAPI` to
  `@klorad/api/museum` (already effectively its home, `extensions/museum.ts`); `RoomsAPI`/
  `FloorPlansAPI` stay in `@klorad/api/campus` for v0.1, generalised into a `SpatialRegion`
  abstraction only when a second vertical needs one, not before; `NavNodesAPI`/`NavEdgesAPI` to a
  navigation extension (`@klorad/api/navigation`); `POIManagerAPI`/`LayersAPI` are already the
  diagram's Location-Based Services and keep their place under Question 1's Integration sub-export.
- B. Leave the flat namespace as it is until each surface's move is individually scoped and PR'd,
  to avoid a large rename before any surface has a real consumer.

**Recommendation.** A. The table was built from a reviewed pass and independently re-verified
against the real exports by a second, later document; re-deciding it from scratch here would
repeat work already done twice.

Decision: ___________________________________________________

## Question 5: the select event, and any other event the Interaction pillar needs in v0.1

**Context.** `SceneEventMap` (`packages/api/src/types/index.ts:110-121`) types ten events,
including `"object:select"` and `"object:deselect"`. `createEventBus`'s `emit` is called from
exactly one place in the whole package, `packages/api/src/impl/scene.ts:110`, and only for
`"scene:change"`. `ObjectsAPI.select` (`packages/api/src/impl/objects.ts:45-47`) calls the store's
`selectObject` directly and never calls `events.emit`, so `"object:select"` is a typed event that
nothing in the SDK ever fires. The website's own marketing sample
(`apps/website/app/platform/page.tsx:101`) calls `world.events.on("select", inspect)`, a string
that is not even a valid `SceneEventType` (the real values are namespaced, `"object:select"` not
`"select"`); PR #306 already fixed this same sample's `createSceneAPI` call to the real two-
argument signature but left this line broken.

**Options.**
- A. Wire `ObjectsAPI.select`/`.deselect` to call `events.emit("object:select", ...)`/
  `events.emit("object:deselect", ...)`, a one-line change in each of two functions, and fix the
  website sample to the real event name in the same pass.
- B. Leave selection events for Phase 2 alongside Action, Entitlement and Behaviour, on the
  reasoning that "Interaction and actuation" per `docs/WORLD-MODEL.md`'s four pillars is the Action
  chain specifically, and object selection is editor UI state, not an Action.

**Recommendation.** A for the emit wiring itself: it is near-zero cost and makes an already-typed
relation honest rather than silently dead. The website sample's broken event name should be fixed
regardless of how this question is decided, it is wrong today independent of this ADR. Whether
selection counts as an "Interaction pillar" event in the thesis sense, versus plain UI state, is a
modelling call left to Teo.

Decision: ___________________________________________________

## Question 6: deferred surfaces, and how "deferred" is expressed in the package

**Context.** `docs/PLAN.md` lists XR among the items "Deferred from Phase 1." `@klorad/engine-
three`'s default entry re-exports it anyway: `src/index.ts` re-exports `./components`
(`packages/engine-three/src/index.ts`), and `components/index.ts:10` exports `XRWrapper`.
Installing `@klorad/engine-three` for any purpose today pulls in `XRWrapper` and its peer
dependencies, whether or not the consumer wants XR. "Deferred" in the plan currently means
"not on the roadmap", not "not shipped."

**Options.**
- A. A subpath export, `@klorad/engine-three/xr`, moving XR and its peers off the default entry so
  the main import stays XR-free. "Deferred" then means "not bundled by default, still reachable
  for a consumer who explicitly imports it", not "gone."
- B. XR stops being deferred and enters v0.1 scope, documented as such, since it already ships and
  works; `docs/PLAN.md`'s Phase 1 deferred list is corrected to drop it.

**Recommendation.** A. Nothing in Phase 1 validates or commits to XR as part of the SDK promise
the quickstart and homepage make; a subpath export keeps it working for whoever already depends on
it without implying it is inside that promise. A follow-up item should audit every other name on
`docs/PLAN.md`'s deferred list (rooms, floor plans, tour) against the same test, shipped-but-
undocumented versus genuinely absent, before npm publish; this ADR does not do that audit itself.

Decision: ___________________________________________________

## Question 7: semver and deprecation policy for 0.x

**Context.** `packages/api` is at `0.0.1` today, `private: true`, with zero runtime callers
anywhere in the repository (`docs/ARCHITECTURE.md` section 4 and section 7's kill list). Root
`CLAUDE.md` already states the general rule: public surfaces are a compatibility promise, breaking
changes need a deprecation note and a migration line in the docs. This question is the 0.x-
specific reading of that rule, and `docs/PLAN.md` commits to publishing `@klorad/api` and the
engine packages as 0.x in Phase 2, "with the ADR-0001 policy", so a decision is a dependency of
that publish, not optional.

**Options.**
- A. Treat 0.x as fully unstable, the standard semver meaning: any `0.x` to `0.(x+1)` bump may
  break, no deprecation window required, a changelog entry required. Fastest to iterate, and
  matches today's state, an unvalidated surface with no confirmed consumer.
- B. Hold 0.x to the 1.x bar from day one: every removal gets a deprecation note and a migration
  line before removal; minor versions only add. Slower, but avoids breaking the first external
  builder once one exists.

**Recommendation.** A hybrid: A until the first external builder (`docs/PLAN.md`'s own Phase 2
metric) starts depending on a published release, B from that point on. The switch is triggered by
an externally observable event, an install from outside Prieston, not a calendar date, so the ADR
states the rule rather than a date.

Decision: ___________________________________________________

## Question 8: npm publish blockers

**Context.** This question is an inventory, not a single choice. Board item 3241122490 (gate:
Needs my approval, its own decision, separate from this one) already scopes the first blocker in
detail: installing `@klorad/engine-three` pulls in `@klorad/engine-cesium` (for `CesiumIonTiles`,
`packages/engine-three/src/Scene.tsx:18,159`), plus `cesium`, MUI and `aws-sdk`, and every peer of
both; `docs/guides/building-a-klorad-app.md` section 2's own install line, nine packages for "one
renderer", documents the symptom directly. `docs/ARCHITECTURE.md` section 7 names a second: none
of `packages/api`'s 1,941 lines is exercised by any build, test or app today, so publishing it
would be the first time any of it is used by anything other than a type check.

**Options.** Not applicable in the usual sense; this question asks the ADR to list what it knows
rather than decide between alternatives.

**Recommendation.** List, don't re-solve: (1) the renderer peer-dependency debt, board item
3241122490, already gated and scoped, stays the owning ticket; (2) `packages/api` having no real
consumer before publish, which Phase 1's kernel work and the quickstart (`docs/PLAN.md`, due 31
October) are already the plan to fix, not a new item; (3) whatever Question 6's deferred-surface
audit turns up, surface by surface, feeds into `docs/DEBT.md` (due 8 October) rather than into this
ADR. This keeps `docs/DEBT.md` inheriting known blockers as line items instead of rediscovering
them later.

Decision: ___________________________________________________

## Appendix: TARGET blocks in the building guide, mapped to these questions

`docs/guides/building-a-klorad-app.md` (PR #309) marks five proposed changes `TARGET API, not
implemented yet, see ADR-0001`. None of them is itself one of the eight questions above; each maps
to one and is unblocked once that question is decided, except the two kernel items which are
sequenced on `docs/PLAN.md`'s build order independent of this ADR.

| Guide section | TARGET proposal | Maps to | Status |
|---|---|---|---|
| 3, Coordinate System | Optional `coordinateSystem: GeoPosition` third argument to `createSceneAPI` | Question 1 (World sub-export home) | Already its own board item (3241121058), not blocked by this ADR |
| 4, Physical correspondence | `correspondence?: "object" \| "shadow" \| "twin"` field on `SceneObject` | Question 1 (World sub-export home) | Already its own board item (3241121059), not blocked by this ADR |
| 5, Data source | `IoTAPI.getData` reads `useIoTStore`; an observation model; a generic fixture connector | Question 1 (Integration sub-export home) | Sequenced by `docs/WORLD-MODEL.md`'s kernel build order (step 2 and 3), not blocked by this ADR |
| 6, Render | `@klorad/react` (`KloradProvider`, `Scene`, `SceneObject`) | Question 3 | Blocked on Question 3's package-shape decision |
| 7, Interaction | `useAction` (Phase 2, kernel step 4) | Question 2 and 5 (engines, events) plus Phase 2's Action/Entitlement/Behaviour work | Not in v0.1 scope regardless of this ADR, per `docs/PLAN.md` |

## Consequences

Once decided, this ADR's answers become the shape `packages/api`'s reorganisation into `/world`
and `/integration` (and `/access` if Question 1 changes) follows, due 15 October per
`docs/PLAN.md`. Nothing in this document authorises writing that reorganisation yet; it is the
decision record the reorganisation PR cites. `docs/WORLD-MODEL.md`'s "Layer rules (proposed, to be
confirmed in ADR-0001)" section gets its "proposed" qualifier removed once these decisions land,
and any question decided differently from its recommendation above gets that difference reflected
there too.
