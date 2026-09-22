"use client";

// Section 6: Scene, CesiumViewer and MapboxViewer all read the same
// @klorad/core store that @klorad/api writes to (docs/ARCHITECTURE.md §3,
// §6), so mounting one next to the calls in section-3/4/5 renders them with
// no wiring in between. Swapping renderers is the one import line per pair.
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
