"use client";

// Section 6: Scene (three.js) and CesiumViewer read the same @klorad/core
// store that @klorad/api writes to (docs/ARCHITECTURE.md §3, §6), so mounting
// either next to the calls in section-3/4/5 renders them with no wiring in
// between, and swapping between those two is the one import line below.
//
// MapboxViewer is different and the guide marks it TARGET: its primary shape
// is mapboxSceneData, and the only objects it draws are those backed by a
// fetchable glb or gltf, through a Threebox layer
// (packages/engine-mapbox/src/hooks/useMapboxThreeboxModels.ts:40,227). It is
// mounted here because it compiles and runs, not because it renders an
// arbitrary SceneObject.
import Scene from "@klorad/engine-three";
import { CesiumViewer } from "@klorad/engine-cesium";
import { MapboxViewer } from "@klorad/engine-mapbox";

export function ThreeViewer() {
  return <Scene />;
}

export function CesiumSceneViewer() {
  return <CesiumViewer />;
}

export function MapboxSceneViewer() {
  // MapboxViewer needs a token; Scene and CesiumViewer need none.
  return <MapboxViewer accessToken="pk.fixture" />;
}
