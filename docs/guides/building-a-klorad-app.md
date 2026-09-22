# Building a Klorad app

This is the first product document of the Klorad SDK, written against the code as it stands
today (`docs/ARCHITECTURE.md`, read 22 September 2026), not a future rewrite (Teo, 21 September
2026: no rewrite of `@klorad/core` before version 1). Read it top to bottom and you end with a
rendered, data-fed twin. Every code block below either compiles, checked by `pnpm check` against
`apps/docs-examples`, or carries the literal marker `TARGET API, not implemented yet, see
ADR-0001` on the line above it. TARGET blocks are proposals for ADR-0001, not a preview of code
that exists; do not implement one from this guide alone.

## 1. What a Klorad app is

Klorad's public API follows the three layers of Teo's doctoral thesis system model
(`docs/WORLD-MODEL.md`).

**World** owns meaning: the Scene, the Scene Objects in it, their classification by physical
correspondence, and the rules that change them. World is pure TypeScript, no React, no renderer
imports, no Prisma; renderers implement what World defines, never the reverse.

**Access** is how people and devices reach the world: users, browsers, entitled participation,
the authorisation process. It depends on World, never the reverse.

**Integration** couples World's semantics to reality: IoT devices, external APIs, location
services, AI. It also depends on World, never the reverse.

Four pillars hold the model up, wherever a given class currently lives:

**Space.** Every scene is defined by an Earth-anchored Coordinate System; geospatial grounding is
structural, not decorative, and governs representation, interaction, persistence and integration.

**Time.** The Time Spectrum governs the scene: simulation time, observation ordering, delayed and
out-of-order updates, temporal consistency.

**Physical correspondence.** Every Scene Object is classified by its relation to the physical
world: a Digital Object has no synchronised physical counterpart, a Digital Shadow receives a
one-way, timestamped flow from the physical thing, a Digital Twin has two-way flow.

**Interaction and actuation.** Actions on a Scene Object are checked against Entitlements and
trigger Behaviours that change world state; Animations visualise the change. The chain runs user
or agent to Action to Entitlement to Behaviour to state change, never the reverse.

## 2. Install

```bash
pnpm add @klorad/api @klorad/engine-three three @react-three/fiber @react-three/drei \
  @react-spring/three @react-three/rapier @react-three/xr @mui/material @mui/icons-material \
  cesium @aws-sdk/client-s3
```

That list is longer than "one renderer" should need. `@klorad/engine-three` depends on
`@klorad/engine-cesium` internally, for `CesiumIonTiles` (`docs/ARCHITECTURE.md` section 1), so
installing three.js support pulls in Cesium's own peer dependencies too. Narrowing this is debt,
not something this guide works around.

## 3. Create a Scene (pure core, no React)

`createSceneAPI(engine, mode)` is the one entry point into `@klorad/api` (`packages/api/src/impl/
scene.ts:130`), two positional arguments, not an options object.

```ts
import { createSceneAPI } from "@klorad/api";
import type { GeoPosition } from "@klorad/api";

const scene = createSceneAPI("three", "editor");

// Space is only partially explicit today (docs/WORLD-MODEL.md: Coordinate
// System, "partial"): the nearest live primitive is GeoPosition, consumed by
// camera.flyToPosition, not stored as a reference object on the scene itself.
const cityHall: GeoPosition = { longitude: 23.7275, latitude: 37.9838 };

await scene.camera.flyToPosition(cityHall, { radius: 200 });
```

```ts
// TARGET API, not implemented yet, see ADR-0001
const scene = createSceneAPI("three", "editor", {
  coordinateSystem: { longitude: 23.7275, latitude: 37.9838, altitude: 0 },
});
scene.coordinateSystem; // GeoPosition — the scene's own anchor
```

Smallest change: an optional third `coordinateSystem: GeoPosition` argument to `createSceneAPI`,
stored on `useSceneStore` next to the existing `selectedLocation` field
(`packages/core/src/state/useSceneStore.ts`), exposed as a read-only `SceneAPI.coordinateSystem`
getter. No engine change.

## 4. Add Scene Objects and classify them

```ts
const lampPost = scene.objects.add({
  name: "Lamp Post 12",
  type: "model",
  url: "/models/lamp-post.glb",
  position: [23.7275, 37.9838, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  interactable: true,
  visible: true,
});

scene.objects.getAll(); // [lampPost]
```

Every `SceneObject` today is a Digital Object in effect, because nothing distinguishes them
(`docs/WORLD-MODEL.md`: "Digital Object ... live (not distinguished)").

```ts
// TARGET API, not implemented yet, see ADR-0001
const lampPost = scene.objects.add({
  // ...as above
  correspondence: "shadow", // "object" | "shadow" | "twin", defaults to "object"
});
```

Smallest change: an optional `correspondence?: "object" | "shadow" | "twin"` field on
`SceneObject` and `SceneObjectInput` (`packages/api/src/types/index.ts:22-35`), defaulted to
`"object"` in `toSceneObject` (`packages/api/src/impl/objects.ts:8-22`). No core or engine change.

## 5. Connect a data source

`digital-twin` mode adds `sensors` and `iot` alongside the base `SceneAPI`
(`packages/api/src/impl/scene.ts:133-135`).

```ts
import type { DigitalTwinAPI } from "@klorad/api";

const twinScene = createSceneAPI("three", "digital-twin") as DigitalTwinAPI;

twinScene.iot.attach(lampPost.id, {
  serviceType: "brightness-sensor",
  apiEndpoint: "https://fixture.local/lamp-12",
  updateInterval: 5000,
  displayFormat: "compact",
  autoRefresh: true,
});
```

`IoTAPI.getData` always returns `null` (`packages/api/src/extensions/digital-twin.ts:73-77`); its
own comment says IoT data lives in the separate `useIoTStore`, but `getData` never reads it.
There is also no generic mock IoT connector today: `@klorad/connectors` ships exactly one
adapter, `inet-atms` (`packages/connectors/src/adapters/inet-atms`), a Parsons ATMS shape built
for Mobility, and its fixture mode (`fixture.ts`) is Mobility-specific, not a general-purpose
Shadow feed.

```ts
// TARGET API, not implemented yet, see ADR-0001
const reading = twinScene.iot.getData(lampPost.id);
// { value: 82, unit: "%", observedAt: "2026-09-22T10:15:00Z" }
```

Smallest changes, in order: (1) `IoTAPI.getData` reads `useIoTStore` instead of returning `null`
(`packages/api/src/extensions/digital-twin.ts:73-77`), enough for a non-timestamped Shadow; (2)
an observation model with timestamps and ordering (kernel step 2, `docs/WORLD-MODEL.md` build
order) so `getData` returns a real `observedAt`, not just a last-known value; (3) a generic
fixture-mode connector in `@klorad/connectors`, not tied to Mobility or ATMS, so "mock IoT
connector" in this section's heading is literally true.

## 6. Render

`Scene` (three.js), `CesiumViewer` and `MapboxViewer` all read the same `@klorad/core` store that
`@klorad/api` writes to (`docs/ARCHITECTURE.md` sections 3 and 6), so mounting one next to the
calls above renders them with no wiring in between.

```tsx
"use client";
import Scene from "@klorad/engine-three";

export function Viewer() {
  return <Scene />;
}
```

One-line change for Cesium:

```tsx
import { CesiumViewer as Scene } from "@klorad/engine-cesium";
```

One-line change for Mapbox:

```tsx
import { MapboxViewer as Scene } from "@klorad/engine-mapbox";
// <Scene accessToken="..." /> — Scene and CesiumViewer need no token, MapboxViewer does.
```

Once `@klorad/react` exists, this section becomes the react-three-fiber-idiom form the rest of
the guide would otherwise use throughout:

```tsx
// TARGET API, not implemented yet, see ADR-0001
import { KloradProvider, Scene, SceneObject } from "@klorad/react";

export function Viewer() {
  return (
    <KloradProvider engine="three" mode="editor">
      <Scene>
        <SceneObject
          name="Lamp Post 12"
          type="model"
          url="/models/lamp-post.glb"
          correspondence="shadow"
        />
      </Scene>
    </KloradProvider>
  );
}
```

Smallest change: a new package, `@klorad/react`, no core or engine change
(`docs/ARCHITECTURE.md` section 6). `KloradProvider` calls `createSceneAPI` and puts it in React
context; `Scene` and `SceneObject` are thin wrappers over `objects.add` / `.update` / `.remove`
from that context, called from mount/update/unmount effects — exactly what
`packages/api/src/react/index.ts`'s `useObjects` already does for the read side, just unwired to
a Provider today. `useScene()` (return the context value) and `useSceneObject(id)` (a selector
keyed by id) are small additions on top of that binding, no core change. `useShadow(id)` cannot
be written honestly until section 5's TARGET items land. `@klorad/core`'s own hooks
(`useSceneStore`, `useWorldStore`, `useIoTStore`) are not re-exported by `@klorad/react`; they are
what the binding wraps, not what an app author imports directly.

## 7. Interaction (Phase 2, not in v0.1)

Actions, Entitlements and Behaviours are absent from the SDK today (`docs/WORLD-MODEL.md`);
Mobility's own alert and rule engine is the nearest app-only analogue. This is kernel step 4,
scheduled for Phase 2 (`docs/PLAN.md`), not version 1.

```tsx
// TARGET API, not implemented yet, see ADR-0001 — Phase 2, kernel step 4
import { useAction } from "@klorad/react";

function LampSwitch({ objectId }: { objectId: string }) {
  const [toggle, { pending }] = useAction(objectId, "toggle-lamp");
  return (
    <button disabled={pending} onClick={() => toggle()}>
      Toggle
    </button>
  );
}
```

There is no "smallest change" for this one: Action, Entitlement and Behaviour do not exist in
any partial form to extend; this needs the kernel step 4 work itself.

## 8. Ship

Apps build with `pnpm build:packages` first (packages resolve each other through `dist/*.d.ts`),
then the app's own `pnpm build`. Klorad's own apps deploy to Vercel and DigitalOcean.

What the hosted platform adds beyond the SDK: tenancy (`Organization` to `Project`), a persisted
`Project.sceneData`, authentication (NextAuth), file storage (DigitalOcean Spaces via
`@klorad/storage`), encrypted credentials (`@klorad/secrets`), and the operator and visitor
split every Klorad surface ships as. None of it is required to run the SDK standalone; it is what
Klorad's own apps add on top, per `docs/PLAN.md`.

## 9. Agent notes

- Entry points: `@klorad/api` to `packages/api/src/index.ts`; the current React read layer to
  `packages/api/src/react/index.ts` (the `./react` sub-export); `@klorad/engine-three` to
  `packages/engine-three/src/index.ts`; `@klorad/engine-cesium` to
  `packages/engine-cesium/src/index.ts`; `@klorad/engine-mapbox` to
  `packages/engine-mapbox/src/index.ts`; `@klorad/connectors` to `packages/connectors/src/
  index.ts`.
- Key types: `SceneAPI`, `ObjectsAPI`, `SceneObject`, `SceneObjectInput`, `DigitalTwinAPI`,
  `IoTAPI` in `packages/api/src/types/interfaces.ts` and `packages/api/src/types/index.ts`.
- `createSceneAPI(engine, mode)` takes two positional arguments. `apps/website/app/platform/
  page.tsx`'s marketing sample calls it with an object instead
  (`docs/ARCHITECTURE.md` section 4); that sample is wrong, do not copy it.
- Rules from the root `CLAUDE.md` that apply to every example above: no React, renderer or Prisma
  import under `packages/api` (the World layer); an app reads and changes world state only
  through `@klorad/api`, never through `@klorad/core` internals or an engine package directly; no
  new public export without a thesis class (`docs/WORLD-MODEL.md`) or an ADR behind it; files
  under 300 lines, functions under 50; run `pnpm check` before calling anything done.
- Every `TARGET API, not implemented yet, see ADR-0001` block above is a proposed addition to
  `@klorad/api` or to the not-yet-existing `@klorad/react`, not a preview of shipped code.

## Thesis name to current export

| Thesis name | Current export | Status |
|---|---|---|
| 3D Scene | `SceneAPI` (`@klorad/api`) | live (as an editor-shaped store) |
| Scene Object | `SceneObject`, `ObjectsAPI` | live (no correspondence classification) |
| Coordinate System | `GeoPosition`, used by `camera.flyToPosition` only | partial |
| Time Spectrum | `EnvironmentAPI.setSimulationTime` | partial |
| Digital Object | any `SceneObject` | live (not distinguished) |
| Digital Shadow | `SensorsAPI`, `IoTAPI` | partial (stub read path) |
| Digital Twin | none | absent |
| Actions / Entitlements / Behaviours | none in the SDK | absent |
| Integration (APIs) | `@klorad/connectors` (`inet-atms` adapter) | live (one adapter) |

Rows taken from `docs/WORLD-MODEL.md`'s own tables, limited to the classes this guide uses.
