// Section 5: digital-twin mode adds sensors/iot to the base SceneAPI
// (packages/api/src/impl/scene.ts). iot.attach is live; iot.getData always
// returns null today (packages/api/src/extensions/digital-twin.ts) — see the
// TARGET block in the guide for why a Shadow can't be read yet.
import { createSceneAPI } from "@klorad/api";
import type { DigitalTwinAPI } from "@klorad/api";
import { lampPost } from "./section-4-objects";

const twinScene = createSceneAPI("three", "digital-twin") as DigitalTwinAPI;

twinScene.iot.attach(lampPost.id, {
  serviceType: "brightness-sensor",
  apiEndpoint: "https://fixture.local/lamp-12",
  updateInterval: 5000,
  displayFormat: "compact",
  autoRefresh: true,
});

const reading = twinScene.iot.getData(lampPost.id); // always null today

export { twinScene, reading };
