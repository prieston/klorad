# Platform inventory: World model coverage against the code

Verifies every row of `docs/WORLD-MODEL.md` (revised 17 September 2026) against the code as of this
writing, and every claim in Section 4 of `docs/website-homepage-draft.md` ("Inside the engine") and
the live homepage H1 ("Build Enterprise Digital Twins in Days, Not Months") against the SDK. Board
item: "Write docs/platform-inventory.md" (Phase 1, due 30 September 2026, `docs/PLAN.md`).

Status values, unchanged from `docs/WORLD-MODEL.md`: **live** (usable by a developer through
`@klorad/api` today, with the thesis semantics, not just the name), **partial**, **app-only**
(exists in a vertical app, not in a package), **absent**. Per "Coverage means relations, not
names" in `docs/WORLD-MODEL.md`: a row is live only if the relation the thesis states — not a
same-named symbol — is executable inside `@klorad/api`.

Code read for this pass: `packages/api/src`, `packages/core/src`, `packages/connectors/src`,
`apps/campus`, `apps/mobility`, `apps/heritage`.

## World layer

| Thesis class | File reference | What exists | What's missing to go live inside `@klorad/api` | Status |
|---|---|---|---|---|
| 3D Scenes | `packages/api/src/impl/scene.ts` (`createSceneAPI`, `buildBaseAPI`), `packages/core/src/state/useSceneStore.ts` | `SceneAPI.load` / `.export` / `.reset` round-trip the full scene (objects, tour stops, ion assets, environment, Mapbox scene data) through `useSceneStore`. | Nothing for the "consists of Scene Objects" relation; the Coordinate System, Physics and Spatial Audio relations the thesis also lists for a Scene are not yet expressed (see their own rows). | live (as an editor-shaped store) |
| Scene Objects | `packages/api/src/impl/objects.ts` (`createObjectsAPI`, `toSceneObject`), `packages/api/src/types/index.ts` (`SceneObject`) | `ObjectsAPI.add/remove/select/setTransform/update/reorder/getAll/getById` cover every object in a scene uniformly. | `SceneObject` has no `correspondence` field, so "classified as Digital Object / Shadow / Twin" and "updated by Behaviours" are not expressed on the object itself (tracked separately, see the two rows below and the open board item to add `correspondence`). | live (no correspondence classification) |
| Coordinate System | `packages/core/src/utils/coordinateUtils.ts` (`setReferenceLocation`, module-level `referenceLatitude`/`referenceLongitude`), `packages/api/src/types/index.ts` (`GeoPosition`) | `GeoPosition` is a typed lng/lat/altitude value used across the API surface (`CameraAPI.flyToPosition`, `POIManagerAPI`, `Room`, `NavNode`). | No Coordinate System object a developer sets on a Scene and reads back: `coordinateUtils.ts` holds a single mutable module-level reference point for the three.js tileset conversion only, not a `SceneAPI` property, and each engine keeps its own default independently. | partial (implicit per engine, no explicit reference object) |
| Time Spectrum | `packages/api/src/impl/environment.ts` (`setSimulationTime` → `useSceneStore().setCesiumCurrentTime`) | `EnvironmentAPI.setSimulationTime(isoTime)` stores one ISO string read back by `EnvironmentAPI.get()`. | No observation model: nothing timestamps an update, orders it against others, or defines simulation-vs-wall-clock time. `setSimulationTime` is a display value, not a spectrum. | partial (no observation ordering, no history) |
| Physics Engine | — | Nothing in `packages/api` or `packages/core`. | The entire relation: an engine-independent physics contract that engines implement. | absent |
| Spatial Audio | — | Nothing in `packages/api` or `packages/core`. | The entire relation. | absent |
| Digital Object | `packages/api/src/types/index.ts` (`SceneObject`) | Every `SceneObject` today is, by omission, a Digital Object (no synchronised physical counterpart). | A `correspondence` field so "Digital Object" is a value, not just the absence of one — currently proposed as the next board item (`correspondence: "object" \| "shadow" \| "twin"`). | live (not distinguished) |
| Digital Shadow | `packages/api/src/extensions/digital-twin.ts` (`createSensorsAPI`, `createIoTAPI`), `packages/core/src/services/IoTService.ts` | `SensorsAPI` attaches viewshed/FOV config to an object; `IoTService` polls Open-Meteo on an interval and writes into a separate `useIoTStore`; `IoTAPI.attach` marks an object as IoT-enabled. | `IoTAPI.getData` returns `null` unconditionally by design (data lives in `useIoTStore`, not through the API) — there is no timestamped observation the Shadow ingests, and no ordering. The file is named `digital-twin.ts` but implements only the one-way Shadow path. | partial (stub read path, no timestamps or ordering) |
| Digital Twin | — (see `digital-twin.ts` above — despite the filename, no outbound port exists) | Nothing that lets an authorised Action reach the physical thing. | The entire relation: an outbound execution port from a Behaviour to a connector. | absent |
| Actions | — | Nothing in `packages/api`; `ObjectsAPI` mutates objects directly with no declared-action vocabulary. | The entire relation: Actions declared per Scene Object type. | absent |
| Entitlement System | `apps/mobility/lib/authz.ts`, `apps/heritage/lib/authz.ts` (`requireProjectAccess`), `packages/prisma/schema.prisma` (`ProjectMember`) | Every operator route in Mobility and Heritage checks `requireProjectAccess(projectId, mode)` against `ProjectMember.role`. | This governs who can reach an operator route, not "authorised participation... of which object Actions are the most concrete primitive." There is no entitlement check inside `@klorad/api` because there is no Action to check it against. | app-only (access control, not world entitlement) |
| Behaviours | `apps/mobility/lib/mobility/alert-rules.ts` (pure `evaluateRules`), `packages/api/src/impl/events.ts` (`createEventBus`), `packages/api/src/types/interfaces.ts` (`SceneEventBusAPI`) | Two unconnected things share this row: `SceneEventBusAPI` is a real, working in-scene pub/sub (`object:*`, `tour:*`, `scene:*`) with no Action/Entitlement chain behind it; Mobility's `alert-rules.ts` is a Prisma-backed, Zod-validated threshold/event evaluator that never imports `@klorad/api` at all. Neither is triggered by an Action. | A Behaviour that an Entitlement-checked Action can trigger, that then updates a Scene Object through `@klorad/api`. `SceneEventBusAPI` usage inside a real app was not found — the only call site is the marketing code sample in `apps/website/app/platform/page.tsx`. | app-only / partial |
| Animations | `packages/api/src/impl/tour.ts` (`createTourAPI`) | `TourAPI` moves the camera through stops; it does not visualise a Behaviour's state change. | The entire relation: a visual response to a Behaviour, once Behaviours exist. | absent |
| Avatars | — | Nothing in `packages/api` or `packages/core`. | The entire relation. | absent |
| Virtual Agents / NPCs | `apps/campus/lib/klio-config.ts`, `apps/campus/lib/consumer/KlioPanel.tsx`, `apps/mobility/lib/paris/tools.ts` | Klio (Campus) and Paris (Mobility) are Anthropic tool-use chat assistants scoped by `worldId`/project, wired directly into each app. | Not an Avatar or NPC in the thesis sense (no world presence, no Entitlement-gated participation) — app-level chat features, no SDK surface. | app-only |
| Chat Bubble | `apps/campus/lib/consumer/KlioSourceCards.tsx`, `apps/mobility/app/(public)/w/[slug]/paris/ParisPanel.tsx` | Chat UI panels in the two apps above. | No SDK participation surface; entirely app UI. | app-only |

## Access layer

| Thesis class | File reference | What exists | What's missing to go live inside `@klorad/api` | Status |
|---|---|---|---|---|
| Users (Field User, Remote User) | `packages/prisma/schema.prisma` (`User`, `OrganizationMember`, `ProjectMember`) | NextAuth-backed `User` with org/project membership rows. | No Field User / Remote User distinction (AR/MR vs VR) anywhere; it is one undifferentiated `User` row, and it is a Prisma model, not an `@klorad/api` type. | app-only |
| Devices | `packages/prisma/schema.prisma` (`PushSubscription`: `endpoint`, `p256dh`, `auth`, `userAgent`) | A push subscription per browser endpoint. | No Device model (a phone, a headset, a kiosk are not represented); a push endpoint is one delivery channel, not a device. | partial |
| Web Browsers | `apps/*/app/**` (Next.js App Router), `packages/ui` (`AppShell`) | Every vertical app and the shared `AppShell` chrome run as ordinary Next.js apps in a browser. | Nothing — this is the one Access row that is genuinely live, because "a Next.js app in a browser" needs no further SDK contract. | live (implicit) |
| Interactable | `packages/api/src/impl/objects.ts` (`select`, `setTransformMode`), engine packages (click/hover handling per renderer) | `ObjectsAPI` exposes selection and transform-mode state; each engine package (`@klorad/engine-three`, `-mapbox`, `-cesium`) implements its own click/hover/drag handling against that state. | No single Interactable contract engines all implement the same way — selection semantics are partly in `@klorad/api`, partly duplicated per engine. | partial |
| WebXR Device API | `packages/core/src/state/xr-store/xr-store.ts` (`useXRStore`) | A zustand store for teleport target, hovered/selected model, controller positions — consumed by the three.js engine's XR mode. | Not exposed through `@klorad/api` at all; it is a `@klorad/core` internal the app/engine reach directly, which is itself the kind of internals-reach Phase 1's Mobility import report is auditing. | partial |
| WebSocket API | — | Nothing in `packages/api` or `packages/core`. | The entire relation. Server-Sent Events exist (`apps/mock-inet/app/api/stream/route.ts`), but that is the mock IoT fixture's own dev feed, not a WebSocket, not in `apps/mobility`, and not part of the SDK — `docs/WORLD-MODEL.md` currently attributes this SSE stream to "Mobility"; corrected in this PR (it lives in `apps/mock-inet`). | absent |
| WebRTC API | — | Nothing anywhere in the codebase. | The entire relation. | absent |
| Notifications API | `apps/campus/lib/push.ts`, `apps/mobility/lib/mobility/world-push.ts`, `packages/prisma/schema.prisma` (`PushSubscription`) | Web push send paths in Campus and Mobility, keyed off `PushSubscription`. | Entirely app + Prisma; no `@klorad/api` surface, no relation to a world Action or Behaviour that triggers a notification. | app-only |
| Authorisation Process | `apps/mobility/lib/authz.ts`, `apps/heritage/lib/authz.ts` (`requireProjectAccess`) | NextAuth session plus `requireProjectAccess(projectId, mode)` gate every operator route in Mobility and Heritage. | App + Prisma, not `@klorad/api`; matches the Entitlement System row's caveat above — this authorises reaching a route, not participating in the world. | app-only |

## Integration layer

| Thesis class | File reference | What exists | What's missing to go live inside `@klorad/api` | Status |
|---|---|---|---|---|
| Location-Based Services | `packages/api/src/extensions/campus.ts` (`createPOIManagerAPI`, `createLayersAPI`), `packages/core/src/routing/find-path.ts` (A* over a generic node/edge graph) | `POIManagerAPI.search/flyTo`, `LayersAPI`, and a pure A* router (Haversine cost, campus-scale graphs) are real and used by Campus's wayfinding. | Scoped to the Campus extension only (`SceneMode === "campus"`); no generic LBS surface at the `@klorad/api` root usable outside that mode. | partial |
| Artificial Intelligence | `apps/mobility/lib/paris/tools.ts`, `apps/campus/lib/klio-config.ts`, `packages/crawler/src/` (`runCrawl`, `createFirecrawlClient`) | Anthropic tool-use assistants scoped per app/world, plus a crawler package for content ingestion. | No `@klorad/api` surface; both the assistants and the crawler are app or standalone-package code, not World/Access/Integration contracts. | app-only |
| IoT Devices | `packages/core/src/services/IoTService.ts`, `packages/api/src/extensions/digital-twin.ts` (`createIoTAPI`), `packages/prisma/schema.prisma` (`MobilityDevice`) | `IoTService` polls one fixed weather API per object; `IoTAPI.attach/detach` mark objects as IoT-enabled; Mobility persists a device catalog from connector sync (`MobilityDevice`). | `IoTAPI.getData` returns `null` by design; the catalog lives in Mobility's Prisma tables via connectors, not through a Shadow ingesting observations in `@klorad/api`. | partial |
| APIs | `packages/connectors/src/types.ts` (`KloradConnector`, `ConnectorFactory`), `packages/connectors/src/registry.ts` (`ConnectorRegistry`), `packages/connectors/src/adapters/inet-atms/` | One real adapter (Parsons iNET ATMS) implementing the full `KloradConnector` contract (`configure`, `testConnection`, cursor-paginated `listEntities`, `getEntity`, `getStatus`), plus a fixture-mode variant for demos. | Nothing for v0.1 scope — this row is the one Integration relation that is genuinely live end to end, for its one adapter. | live (one adapter) |

## Homepage claims against the SDK

Checked against `docs/website-homepage-draft.md` Section 4 ("Inside the engine") and the live H1
"Build Enterprise Digital Twins in Days, Not Months" (`apps/website/app/page.tsx`). The live
`/platform` page (`apps/website/app/platform/page.tsx`) elaborates the same tagline with stronger
claims; included below where it bears on the same claim, since it is reachable today at the same
URL the H1 links to.

| Claim | Source | Status | Why |
|---|---|---|---|
| "Build Enterprise Digital Twins in Days, Not Months" | `apps/website/app/page.tsx` (H1) | absent | Digital Twin (two-way sync) is absent in the SDK (see World layer table). What ships today is closer to a Digital Object/partial-Shadow editor, and there is no quickstart yet that takes a developer from empty project to a rendered twin (Phase 1, due 31 October per `docs/PLAN.md`). |
| "A single, engine-agnostic model of scenes, objects, and observations. Define a world once." | Draft §4, "One World model" | partial | Scenes and objects are engine-agnostic and live. "Observations" is not a modelled concept anywhere in `@klorad/api` — the closest thing, `EnvironmentAPI.setSimulationTime`, stores a display string with no timestamped, ordered observation stream. |
| "Three.js for built scenes, CesiumJS for the geospatial globe and 3D tiles, Mapbox for mapping. Same world, the right renderer." | Draft §4, "Three renderers" | live | `@klorad/engine-three`, `@klorad/engine-cesium`, `@klorad/engine-mapbox` exist and all implement `createSceneAPI`'s `Engine` union; this is accurately described. |
| "IoT and sensor telemetry stream into the world in real time. Twins that move with the thing they mirror." | Draft §4, "Live data" | partial | Telemetry streams into Mobility's Prisma tables via connectors and into `useIoTStore` via `IoTService`, both app/core-internal. Nothing streams into a Scene Object through `@klorad/api` (`IoTAPI.getData` returns `null`), and there is no Twin to "move with the thing it mirrors" — that path is absent. |
| "Worlds are XR-ready — explorable on a screen, or stepped into." | Draft §4, "Immersive & XR" | partial | `useXRStore` and three.js XR mode exist and work, but only for the three.js engine, and only reachable through `@klorad/core` internals, not `@klorad/api`. |
| "Organizations, projects, and access control built in from the core." | Draft §4, "Multi-tenant" | app-only | Real and load-bearing (`Organization` → `Project` → `ProjectMember`, `requireProjectAccess`), but it is application infrastructure in Prisma/app code, not a `@klorad/api` surface — accurate as a platform claim, not as an SDK claim. |
| "`@klorad/api`: a programmatic scene API with an extension for each vertical. Build your own world on the foundation." | Draft §4, "The SDK" | live | Accurate: `createSceneAPI(engine, mode)` returns the base `SceneAPI` plus the `digital-twin` / `museum` / `campus` extension for its mode, and every vertical is built on it for scene/object/tour/environment/assets. |
| "Utilizing standard browser interfaces including the WebXR Device API, WebSocket API, and WebRTC, Klorad delivers low-latency, immersive multi-user collaboration" | `/platform` page, "The Access Layer" | absent | WebXR is partial (three.js only, core-internal); WebSocket and WebRTC are both absent (see Access layer table); there is no multi-user collaboration anywhere in the codebase. |
| "a persistent Physics Engine, this layer maintains absolute spatial data integrity. Temporal state correctness is strictly governed by our proprietary Time Spectrum interface, filtering sequential data packet delays and lag to eliminate tracking drift" | `/platform` page, "The World Layer" | absent | Physics Engine is absent. Time Spectrum is `EnvironmentAPI.setSimulationTime`, one ISO string with no ordering, delay handling, or drift correction of any kind. |
| "Klorad establishes a true, bidirectional data flow. Virtual triggers execute physical edge changes" | `/platform` page, "The Klorad differentiator" | absent | This is the Digital Twin outbound path, which is absent (see World layer table): no Action, Entitlement, Behaviour, or connector outbound port exists yet. |
| `world.events.on("select", inspect)` (code sample) | `/platform` page, `codeSample` | absent | Not a valid call: `SceneEventBusAPI.on` is typed over `SceneEventType`, whose values are `"object:select"`, `"object:deselect"`, `"object:add"`, `"object:remove"`, `"object:move"`, `"tour:*"`, `"scene:*"` — there is no `"select"` event. The sample does not compile against the real `@klorad/api` types. |

## `@klorad/api` exports with no home in the diagram

Every one of these is already listed with a proposed ADR-0001 home in `docs/WORLD-MODEL.md`'s
"Surfaces present today that are not in the diagram" table; this is the same list read off the
actual exports rather than the doc's own description, to confirm nothing has drifted.

- `AssetsAPI` / `createAssetsAPI` (`packages/api/src/impl/assets.ts`) — Cesium ion asset management. Proposed home: `@klorad/engine-cesium`.
- `EnvironmentAPI` / `createEnvironmentAPI` (`packages/api/src/impl/environment.ts`) — basemap, skybox, lighting, simulation time bundled under one interface. Proposed: dismantled across engine concerns, Scene Object state, and Time Spectrum.
- `TourAPI` / `createTourAPI` (`packages/api/src/impl/tour.ts`) — camera waypoint orchestration. Proposed home: an experience extension, not Animation.
- `ExhibitsAPI` / `createExhibitsAPI` (`packages/api/src/extensions/museum.ts`) — museum label/media metadata on an object's `meta`. Proposed home: `@klorad/api/museum`.
- `POIManagerAPI`, `LayersAPI`, `FloorPlansAPI`, `RoomsAPI`, `NavNodesAPI`, `NavEdgesAPI`, `CampusAPI` (`packages/api/src/extensions/campus.ts`, `packages/api/src/types/interfaces.ts`) — the full Campus vertical extension. `POIManagerAPI`/`LayersAPI` are already the diagram's Location-Based Services; `FloorPlansAPI`/`RoomsAPI` stay in `@klorad/api/campus` for v0.1 per the doc; `NavNodesAPI`/`NavEdgesAPI` proposed for a navigation extension.
- `SensorsAPI` / `createSensorsAPI` (`packages/api/src/extensions/digital-twin.ts`) — viewshed/FOV config, not itself a thesis class; it configures the Digital Shadow relation above rather than naming a diagram box of its own.

No export was found that isn't already accounted for in `docs/WORLD-MODEL.md`'s surfaces table.

## Errors found and fixed in `docs/WORLD-MODEL.md`

- **WebSocket API row**: said "SSE dev-only in Mobility." The SSE stream (`text/event-stream`,
  `EventSource`) lives in `apps/mock-inet/app/api/stream/route.ts` — the mock IoT fixture app, not
  `apps/mobility`. Corrected in this PR.
