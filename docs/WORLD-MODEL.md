# Klorad World Model: aligning the public API with the thesis

The public API of Klorad is being aligned with the system model of Teo's doctoral thesis on modelling 3D geospatial data and location-based services (`docs/world-model.webp`, also published at `apps/website/public/research/klorad-system-model.png`). The thesis defines the architecture. `@klorad/api` defines its executable domain contract. Engines render that contract. Connectors couple it to external and physical systems.

Revised 17 September 2026 after a review against the thesis text. Status values in the tables: **live** (usable by a developer through `@klorad/api` today, with the thesis semantics, not just the name), **partial**, **app-only** (exists in a vertical app, not in a package), **absent**. They are a first reading and the coverage inventory verifies them.

## The four pillars

Read from the thesis rather than from the diagram's box count, the model rests on four things, and everything else in the diagram serves them.

**Space.** Every scene is defined by an Earth-anchored Coordinate System. Geospatial grounding is structural, not decorative: it governs representation, interaction, persistence and integration. This is the thesis's most distinctive claim and the one a generic twin platform lacks.

**Time.** The Time Spectrum governs the scene: simulation time, observation ordering, delayed and out-of-order updates, temporal consistency. A Digital Shadow without timestamps and ordering is barely a shadow.

**Physical correspondence.** Scene Objects include everything in the scene (lights and cameras too) and are classified by their relation to the physical world: a Digital Object has no synchronised physical counterpart (the thesis's "digital model" case, which Klorad names DigitalObject as a Scene Object classification), a Digital Shadow receives one-way flow from the physical thing, a Digital Twin has two-way flow. The classification is a property of a Scene Object with real synchronisation capabilities behind it, never a bare discriminator and never three unrelated object systems.

**Interaction and actuation.** Actions define what can be done to a Scene Object. The Entitlement System governs authorised participation, of which object Actions are the most concrete primitive but not the only one (entering an area, operating a vehicle). Actions trigger Behaviours, the predefined responses that change world state, and Animations visualise Behaviours. The chain is user or agent → Action → entitlement check → Behaviour → state change or Animation. Not the reverse.

Integration then couples these semantics to reality (IoT, APIs, location services, AI), and Access is how people and devices reach the world.

## Layer rules (proposed, to be confirmed in ADR-0001)

- Klorad implements the thesis World layer as an engine-independent semantic domain model. Rendering responsibilities that the thesis places conceptually inside the World layer are fulfilled by renderer adapters implementing World contracts. This is an implementation refinement of the thesis, made for the interoperability and engine independence the thesis itself asks for, not a claim that the thesis prescribes it.
- **World owns meaning, engines own execution.** `@klorad/api/world` is pure TypeScript: no React, no renderer imports, no Prisma. Physics, Spatial Audio, Animations and picking are World concepts whose semantics and capabilities World defines and whose execution an engine provides. Dependency direction: Access → World ← Integration; engines depend on World, never the reverse.
- **Apps must not bypass the public API to manipulate world state.** A vertical app reads and changes scenes, objects, correspondence, actions and behaviours only through `@klorad/api`. Application infrastructure (authentication UI, persistence, Prisma, encrypted secrets, analytics, business workflows) stays in the app or in server packages; it is not forced into the world API. Today `@klorad/core` mixes the model with zustand stores, React hooks and engine actions; the split is Phase 1 work.
- **No public export without a thesis class or an ADR behind it.** A proposed surface either maps to the diagram or gets an ADR that says which layer it extends and why.

## World layer

| Thesis class | Relation in the thesis | Today | Status |
|---|---|---|---|
| 3D Scenes | Consists of Scene Objects; defined by Coordinate System; governed by Time Spectrum and Physics; contains Spatial Audio | `SceneAPI` (`load`, `export`, `reset`), `SceneData`, `useSceneStore` in core | live (as an editor-shaped store) |
| Scene Objects | Everything in a scene; classified as Digital Object / Shadow / Twin; perform Actions; updated by Behaviours | `ObjectsAPI`, `SceneObject`, `Model` in core | live (no correspondence classification) |
| Coordinate System | Defines every scene; Location-Based Services rely on it | `GeoPosition`, `core/utils/coordinateUtils`, engine choice per project | partial (implicit per engine, no explicit reference object) |
| Time Spectrum | Governs the scene; ordering and consistency of observations | `EnvironmentAPI.setSimulationTime` only | partial (no observation ordering, no history) |
| Physics Engine | Governs scenes and objects | none | absent |
| Spatial Audio | Contained in scenes, emitted by objects | none | absent |
| Digital Object | Scene Object without synchronised physical counterpart | any `SceneObject` | live (not distinguished) |
| Digital Shadow | One-way: physical → object, timestamped | `SensorsAPI`, `IoTAPI.attach`, `IoTService` polling; `IoTAPI.getData` returns null | partial (stub read path, no timestamps or ordering) |
| Digital Twin | Two-way: object can act on the physical thing | none | absent |
| Actions | Available actions per Scene Object; enabled by Entitlements; trigger Behaviours | none in SDK | absent |
| Entitlement System | Authorised participation and protected capabilities, incl. Actions | `requireProjectAccess`, `ProjectMember` roles (apps + Prisma) | app-only (access control, not world entitlement) |
| Behaviours | Predefined responses triggered by Actions; update Scene Objects | Mobility alert/rule engine (app), `SceneEventBusAPI` | app-only / partial |
| Animations | Visualise Behaviours | none as such (`TourAPI` is an experience abstraction, not Animation) | absent |
| Avatars | Users represented in the world | none | absent |
| Virtual Agents / NPCs | Avatars enhanced by AI | Klio (Campus), Paris (Mobility): app code | app-only |
| Chat Bubble | Participation surface for avatars | chat UIs in Campus and Mobility apps | app-only |

## Access layer

| Thesis class | Today | Status |
|---|---|---|
| Users (Field User, Remote User) | NextAuth `User`, `OrganizationMember`, `ProjectMember` | app-only |
| Devices | none as a model; push subscriptions per browser | partial |
| Web Browsers | Next.js apps; `AppShell` in `@klorad/ui` | live (implicit) |
| Interactable | Selection, transform modes, click handling in engines and `ObjectsAPI` | partial |
| WebXR Device API | `core/state/xr-store` | partial |
| WebSocket API | none in SDK (SSE dev-only in the `apps/mock-inet` fixture) | absent |
| WebRTC API | none | absent |
| Notifications API | web push pipeline in Campus and Mobility apps | app-only |
| Authorisation Process | NextAuth + `requireProjectAccess` per app | app-only |

## Integration layer

| Thesis class | Today | Status |
|---|---|---|
| Location-Based Services | `POIManagerAPI`, `LayersAPI`, `core/routing/find-path` | partial |
| Artificial Intelligence | Anthropic tool-use inside apps; `@klorad/crawler` | app-only |
| IoT Devices | `IoTService`, `IoTAPI`, `MobilityDevice` catalog via connectors | partial |
| APIs | `@klorad/connectors` (`KloradConnector`, `ConnectorRegistry`, iNET adapter, fixture mode) | live (one adapter) |

## Coverage means relations, not names

A coverage inventory that checks whether a TypeScript symbol with the right name exists reports false progress. A row is **live** only when the relation the thesis states is executable: a Scene is defined by a Coordinate System a developer can set and query; Time governs observation ordering on a Shadow; an Action on an Object is checked against an Entitlement and triggers a Behaviour that changes state. `interface TimeSpectrum {}` closes nothing.

## Surfaces present today that are not in the diagram

None is removed; each gets a home in ADR-0001.

| Surface | Proposed home | Why |
|---|---|---|
| `AssetsAPI` (Cesium ion) | `@klorad/engine-cesium` | Vendor infrastructure. World may know an abstract resource reference, never ion. |
| `EnvironmentAPI` (basemap, skybox, lighting, simulation time) | Dismantled: basemap and skybox → engine concerns; lighting → Scene Object / world state; simulation time → Time Spectrum | Four different concepts under one name. |
| `TourAPI` | Optional experience extension (`@klorad/api/experiences` or similar) | Orchestrates camera, timing, transitions, entitlements; not an Animation, not museum-only. |
| `ExhibitsAPI` | Vertical extension `@klorad/api/museum` | Cultural heritage semantics that reference Scene Objects. |
| `RoomsAPI`, `FloorPlansAPI` | Stay in `@klorad/api/campus` for v0.1 | Rooms are generic spatial regions and floors are generic subdivisions; the generalisation (`SpatialRegion` with `Room` as a specialisation, floor plans split into semantic levels versus asset files) is done when a second vertical needs it, not before. |
| `NavNodesAPI` | Navigation extension (`@klorad/api/navigation`) | A computational graph attached to world space, matching the thesis's path-discoverability principle; not a Scene Object subtype. |
| `POIManagerAPI`, `LayersAPI` | Integration, Location-Based Services | Already in the diagram; kept. |

## Build order (from the thesis dependency chain)

Space → Time → Scene Object and state → Physical correspondence → Actions, Entitlements, Behaviours → Integration → Rendering.

1. **Space and identity.** Scene, Scene Object, explicit Coordinate System, transforms, stable ids, lookup.
2. **Time and state.** Observation model with timestamps and ordering; state provenance; Time Spectrum v1.
3. **Physical correspondence.** DigitalObject / DigitalShadow / DigitalTwin as Scene Object classification with real synchronisation capabilities: a Shadow ingests timestamped observations; a Twin additionally exposes an outbound port.
4. **Action → Entitlement → Behaviour.** Actions declared per object, validated by Entitlements, executing Behaviours that mutate world state; Animations as the visual response.
5. **Integration.** Connectors supply inbound observations to Shadows and outbound execution for Twins through the contracts above.
6. **Rendering.** One renderer proves the kernel; the other two prove renderer independence.

## v0.1 scope (the kernel, not the box count)

`@klorad/api` v0.1 lets a developer create a georeferenced Scene, put typed Scene Objects in it, transform and query them in a defined Coordinate System, represent their state over a defined time model, classify physical correspondence, ingest timestamped observations into a Shadow, expose Actions on an object, validate them through Entitlements, execute Behaviours that mutate world state, and for a Twin route an authorised Action through an Integration port toward a physical system. That kernel is proven end to end with one renderer (three.js) and one connector (a mock IoT source), and that proof is the quickstart. Cesium and Mapbox then prove renderer independence; the Mobility rewrite is the Mapbox proof. Physics, Spatial Audio, Avatars, NPCs, Chat Bubble, WebRTC, Notifications and the wider Access abstractions are part of the complete architecture and come later; they are not needed for v0.1 to be coherent.
