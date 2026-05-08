import { useSceneStore } from "@klorad/core";
import type { SensorsAPI, IoTAPI } from "../types/interfaces";
import type { SensorConfig, IoTConfig } from "../types";

export function createSensorsAPI(): SensorsAPI {
  const get = () => useSceneStore.getState();

  return {
    attach(objectId, config: SensorConfig) {
      get().updateObjectProperty(objectId, "observationProperties", {
        sensorType: config.shape === "dome" ? "cone" : config.shape,
        fov: config.fov ?? 60,
        fovH: config.fovH,
        fovV: config.fovV,
        visibilityRadius: config.range,
        showSensorGeometry: config.showGeometry ?? true,
        showViewshed: config.showViewshed ?? false,
        sensorColor: config.color,
        viewshedOpacity: config.viewshedOpacity ?? 0.35,
        analysisQuality: config.analysisQuality ?? "medium",
        enableTransformEditor: false,
        alignWithModelFront: true,
      });
    },

    detach(objectId) {
      get().updateObjectProperty(objectId, "observationProperties", undefined);
    },

    async computeViewshed(objectId) {
      get().startVisibilityCalculation(objectId);
    },

    update(objectId, patch: Partial<SensorConfig>) {
      const current = get().objects.find((o) => o.id === objectId)?.observationProperties as Record<string, unknown> | undefined;
      if (!current) return;
      get().updateObjectProperty(objectId, "observationProperties", {
        ...current,
        ...(patch.fov !== undefined && { fov: patch.fov }),
        ...(patch.fovH !== undefined && { fovH: patch.fovH }),
        ...(patch.fovV !== undefined && { fovV: patch.fovV }),
        ...(patch.range !== undefined && { visibilityRadius: patch.range }),
        ...(patch.color !== undefined && { sensorColor: patch.color }),
        ...(patch.showGeometry !== undefined && { showSensorGeometry: patch.showGeometry }),
        ...(patch.showViewshed !== undefined && { showViewshed: patch.showViewshed }),
        ...(patch.viewshedOpacity !== undefined && { viewshedOpacity: patch.viewshedOpacity }),
        ...(patch.analysisQuality !== undefined && { analysisQuality: patch.analysisQuality }),
      });
    },
  };
}

export function createIoTAPI(): IoTAPI {
  const get = () => useSceneStore.getState();

  return {
    attach(objectId, config: IoTConfig) {
      get().updateObjectProperty(objectId, "iotProperties", {
        enabled: true,
        serviceType: config.serviceType,
        apiEndpoint: config.apiEndpoint,
        updateInterval: config.updateInterval,
        displayFormat: config.displayFormat,
        autoRefresh: config.autoRefresh,
        showInScene: true,
      });
    },

    detach(objectId) {
      get().updateObjectProperty(objectId, "iotProperties", undefined);
    },

    getData(_objectId) {
      // IoT data lives in the separate useIoTStore to avoid re-renders.
      // Apps should use useIoTStore directly for reactive access.
      return null;
    },

    startPolling() {
      // IoTService starts polling automatically when objects have iotProperties enabled.
    },

    stopPolling() {
      // Future: expose stop handle from IoTService
    },
  };
}
