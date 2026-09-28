---
title: "One world model, three renderers: what createSceneAPI actually gives you"
date: 2026-09-28
status: draft
---

For a few months the platform page showed this line as the way to start with
`@klorad/api`:

```ts
const world = createSceneAPI({ engine: "cesium" });
```

It was wrong. `createSceneAPI` does not take an options object; it takes two
positional arguments, an engine and a mode
(`packages/api/src/impl/scene.ts:130`):

```ts
import { createSceneAPI } from "@klorad/api";

const world = createSceneAPI("cesium", "viewer");

world.objects.add(model);
world.events.on("select", inspect);
```

Anyone who copied the old sample got a scene built for engine `undefined`. That is a
small bug, and it was fixed this week (#306). It is also a good excuse to say what the
function is actually for, because the two arguments are not interchangeable
conveniences, they are the two axes `@klorad/api` is organised around.

## The engine argument

`Engine` is `"three" | "cesium" | "mapbox"` (`packages/api/src/types/index.ts:5`). Three
renderer packages, `@klorad/engine-three`, `@klorad/engine-cesium`, and
`@klorad/engine-mapbox`, implement the same contract against three different runtimes:
a general-purpose WebGL scene graph, a geospatial globe with 3D tiles, and a map. The
engine argument is not a rendering hint passed down to a single implementation; it
selects which renderer's implementation of the contract you are driving. The object
you get back from `createSceneAPI` exposes the same `objects`, `camera`, `tour`,
`assets`, `environment`, and `events` surface no matter which engine you picked
(`buildBaseAPI`, `packages/api/src/impl/scene.ts:113`). That is the point of the split
documented in `docs/WORLD-MODEL.md`: World owns meaning, engines own execution. You
describe a scene once against the World contract; the engine argument decides who
executes it.

## The mode argument

`SceneMode` is `"editor" | "digital-twin" | "museum" | "campus" | "viewer"`
(`packages/api/src/types/index.ts:6`). `"viewer"` returns the base `SceneAPI`, the
surface above and nothing else. The other three modes layer an extension onto that
base:

- `"digital-twin"` adds `sensors` and `iot` (`createSensorsAPI`, `createIoTAPI`,
  `packages/api/src/extensions/digital-twin.ts`).
- `"museum"` adds `exhibits` (`createExhibitsAPI`,
  `packages/api/src/extensions/museum.ts`).
- `"campus"` adds the Campus extension (`createCampusExtension`,
  `packages/api/src/extensions/campus.ts`).

`createSceneAPI` picks the extension with a plain `if` chain
(`packages/api/src/impl/scene.ts:130-144`); there is no plugin registry to configure,
no build-time flag. You ask for a mode, you get the base surface plus that mode's
extension, typed as `SceneAPI`, `DigitalTwinAPI`, `VirtualMuseumAPI`, or `CampusAPI`.

## Where the mode argument stops short

It is tempting to read `"digital-twin"` mode as Klorad's implementation of the thesis's
Digital Twin, the Scene Object class with two-way physical synchronisation. It is not,
yet. `docs/WORLD-MODEL.md` is explicit that Physical correspondence, whether a given
Scene Object is a Digital Object, a Digital Shadow, or a Digital Twin, is supposed to
be a classification on the object, with real synchronisation behind it. What exists
today is a mode-level extension that adds an `IoTAPI` to the whole scene, and that
API's read path is a stub: `iot.getData(objectId)` returns `null` unconditionally
(`packages/api/src/extensions/digital-twin.ts:73`), with a comment pointing you at
`useIoTStore` in `@klorad/core` instead, outside the public API. `startPolling` and
`stopPolling` are no-ops for the same reason. That is why `docs/WORLD-MODEL.md` marks
Digital Shadow **partial** and Digital Twin **absent**: a Scene Object classification
with a real observation model and two-way flow is Phase 1 and Phase 2 kernel work, not
something `"digital-twin"` mode gives you today. What you get now is the shape of the
extension, `sensors` and `iot` as first-class members of the returned object, ready for
the real implementation to land underneath without another breaking signature change.

That is the honest way to read a mode argument in a pre-1.0 SDK: it commits to a
shape, not yet to everything the name implies.
