import { v4 as uuidv4 } from "uuid";
import * as THREE from "three";
import type { Model } from "./types";
import { findIntersectionPoint } from "./helpers";

export function createDefaultObservationProperties() {
  return {
    sensorType: "cone" as "cone" | "rectangle",
    fov: 60,
    visibilityRadius: 500,
    showSensorGeometry: true,
    showViewshed: false,
    analysisQuality: "medium" as "low" | "medium" | "high",
    enableTransformEditor: true,
    alignWithModelFront: true,
    // Use theme colors: success green (#22c55e) and primary blue (#0080ff)
    sensorColor: "#22c55e",
    viewshedColor: "#0080ff",
    viewshedOpacity: 0.35, // Default opacity for viewshed colors (0-1)
    clearance: 2.0,
    raysAzimuth: 120,
    raysElevation: 8,
    stepCount: 64,
  };
}

export function createDefaultIotProperties() {
  return {
    enabled: false,
    serviceType: "weather",
    apiEndpoint: "https://api.open-meteo.com/v1/forecast",
    updateInterval: 2000,
    showInScene: true,
    displayFormat: "compact" as "compact" | "detailed" | "minimal",
    autoRefresh: true,
  };
}

export function createNewModel(
  model: Partial<Model>,
  scene: THREE.Scene | null,
  camera: THREE.Camera | null
): Model {
  let position: [number, number, number] = [0, 0, 0];
  let coordinateSystem = "local";

  if (scene && camera) {
    position = findIntersectionPoint(scene, camera);
  } else if (model.position) {
    position = model.position;
    const [x, y, z] = model.position;
    const isGeographic =
      x >= -180 && x <= 180 && y >= -90 && y <= 90 && Math.abs(z) < 50000;
    coordinateSystem = isGeographic ? "geographic" : "local";
  }

  return {
    id: uuidv4(),
    name: model.name || "",
    url: model.url || "",
    type: model.type || "model",
    position,
    rotation: model.rotation || [0, 0, 0],
    scale: model.scale || [1, 1, 1],
    apiKey: model.apiKey,
    assetId: model.assetId,
    material: model.material || { color: "#ffffff" },
    coordinateSystem,
    isObservationModel: model.isObservationModel || false,
    interactable: model.interactable !== undefined ? model.interactable : true,
    observationProperties: model.observationProperties,
  };
}
