import { useSceneStore } from "@klorad/core";
import type { SceneAPI, DigitalTwinAPI, VirtualMuseumAPI, CampusAPI } from "../types/interfaces";
import type { SceneData, SceneObject, Vector3, Engine, SceneMode } from "../types";
import { createObjectsAPI } from "./objects";
import { createTourAPI } from "./tour";
import { createAssetsAPI } from "./assets";
import { createEnvironmentAPI } from "./environment";
import { createCameraAPI } from "./camera";
import { createEventBus } from "./events";
import { createSensorsAPI, createIoTAPI } from "../extensions/digital-twin";
import { createExhibitsAPI } from "../extensions/museum";
import { createCampusExtension } from "../extensions/campus";

type RawObject = ReturnType<typeof useSceneStore.getState>["objects"][number];
type RawPoint = ReturnType<typeof useSceneStore.getState>["observationPoints"][number];
type RawAsset = ReturnType<typeof useSceneStore.getState>["cesiumIonAssets"][number];

function exportScene(): SceneData {
  const s = useSceneStore.getState();
  return {
    objects: s.objects.map((obj: RawObject): SceneObject => ({
      id: obj.id,
      name: obj.name ?? "",
      url: obj.url,
      position: (obj.position as Vector3) ?? [0, 0, 0],
      rotation: (obj.rotation as Vector3) ?? [0, 0, 0],
      scale: (obj.scale as Vector3) ?? [1, 1, 1],
      type: (obj.type as SceneObject["type"]) ?? "model",
      interactable: (obj as Record<string, unknown>).interactable !== false,
      visible: (obj as Record<string, unknown>).visible !== false,
      meta: (obj as Record<string, unknown>).meta as Record<string, unknown> | undefined,
    })),
    tourStops: s.observationPoints.map((p: RawPoint) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      cameraPosition: p.position as Vector3 | null,
      cameraTarget: p.target as Vector3 | null,
      linkedObjectId: p.connectedModelId,
    })),
    assets: s.cesiumIonAssets.map((a: RawAsset) => ({
      id: a.id,
      name: a.name,
      assetId: a.assetId,
      apiKey: a.apiKey,
      enabled: a.enabled,
      transform: a.transform,
    })),
    environment: {
      basemap: s.basemapType,
      skybox: s.skyboxType,
      ambientLightIntensity: s.ambientLightIntensity,
      gridEnabled: s.gridEnabled,
      groundPlaneEnabled: s.groundPlaneEnabled,
      shadowsEnabled: s.cesiumShadowsEnabled,
      lightingEnabled: s.cesiumLightingEnabled,
      simulationTime: s.cesiumCurrentTime ?? undefined,
    },
    mapboxScene: s.mapboxSceneData,
  };
}

function loadScene(data: Partial<SceneData>, events: ReturnType<typeof createEventBus>): void {
  const s = useSceneStore.getState();

  if (data.objects) {
    s.setObjects(data.objects as Parameters<typeof s.setObjects>[0]);
  }
  if (data.tourStops) {
    s.setObservationPoints(
      data.tourStops.map((stop) => ({
        id: stop.id,
        title: stop.title,
        description: stop.description,
        position: stop.cameraPosition,
        target: stop.cameraTarget,
        connectedModelId: stop.linkedObjectId,
      }))
    );
  }
  if (data.assets) {
    s.setCesiumIonAssets(
      data.assets.map((a) => ({
        id: a.id,
        name: a.name,
        assetId: a.assetId ?? "",
        apiKey: a.apiKey ?? "",
        enabled: a.enabled,
        transform: a.transform,
      }))
    );
  }

  const env = data.environment;
  if (env) {
    if (env.basemap !== undefined) s.setBasemapType(env.basemap);
    if (env.skybox !== undefined) s.setSkyboxType(env.skybox);
    if (env.ambientLightIntensity !== undefined) s.setAmbientLightIntensity(env.ambientLightIntensity);
    if (env.gridEnabled !== undefined) s.setGridEnabled(env.gridEnabled);
    if (env.groundPlaneEnabled !== undefined) s.setGroundPlaneEnabled(env.groundPlaneEnabled);
    if (env.shadowsEnabled !== undefined) s.setCesiumShadowsEnabled(env.shadowsEnabled);
    if (env.lightingEnabled !== undefined) s.setCesiumLightingEnabled(env.lightingEnabled);
    if (env.simulationTime) s.setCesiumCurrentTime(env.simulationTime);
  }

  if (data.mapboxScene && typeof data.mapboxScene === "object") {
    s.setMapboxSceneData(data.mapboxScene as Parameters<typeof s.setMapboxSceneData>[0]);
  }

  events.emit("scene:change", { data: data as SceneData });
}

function buildBaseAPI(engine: Engine): SceneAPI {
  const events = createEventBus();

  return {
    engine,
    camera: createCameraAPI(),
    objects: createObjectsAPI(),
    tour: createTourAPI(),
    assets: createAssetsAPI(),
    environment: createEnvironmentAPI(),
    events,
    load: (data: Partial<SceneData>) => loadScene(data, events),
    export: exportScene,
    reset: () => useSceneStore.getState().resetScene(),
  };
}

export function createSceneAPI(engine: Engine, mode: SceneMode): SceneAPI | DigitalTwinAPI | VirtualMuseumAPI | CampusAPI {
  const base = buildBaseAPI(engine);

  if (mode === "digital-twin") {
    return { ...base, sensors: createSensorsAPI(), iot: createIoTAPI() } as DigitalTwinAPI;
  }

  if (mode === "museum") {
    return { ...base, exhibits: createExhibitsAPI() } as VirtualMuseumAPI;
  }

  if (mode === "campus") {
    return { ...base, ...createCampusExtension() } as CampusAPI;
  }

  return base;
}
