// Section 3 of docs/guides/building-a-klorad-app.md: the pure-core, non-React
// entry point. createSceneAPI + ObjectsAPI are the only two live pieces this
// section relies on; see docs/ARCHITECTURE.md §4 for what each one reaches.
import { createSceneAPI } from "@klorad/api";
import type { GeoPosition } from "@klorad/api";

const scene = createSceneAPI("three", "editor");

// Space is only partially explicit today (docs/WORLD-MODEL.md: Coordinate
// System, "partial"): the nearest live primitive is GeoPosition, consumed by
// camera.flyToPosition, not stored as a reference object on the scene itself.
const cityHall: GeoPosition = {
  longitude: 23.7275,
  latitude: 37.9838,
};

async function focusCityHall(): Promise<void> {
  await scene.camera.flyToPosition(cityHall, { radius: 200 });
}

void focusCityHall;

export { scene };
