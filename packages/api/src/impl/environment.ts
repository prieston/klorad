import { useSceneStore } from "@klorad/core";
import type { EnvironmentAPI } from "../types/interfaces";
import type { SceneEnvironment, BasemapType, SkyboxType } from "../types";

export function createEnvironmentAPI(): EnvironmentAPI {
  const get = () => useSceneStore.getState();

  return {
    setBasemap(type: BasemapType) {
      get().setBasemapType(type);
    },

    setSkybox(type: SkyboxType) {
      get().setSkyboxType(type);
    },

    setAmbientLight(intensity: number) {
      get().setAmbientLightIntensity(intensity);
    },

    setGrid(enabled: boolean) {
      get().setGridEnabled(enabled);
    },

    setGroundPlane(enabled: boolean) {
      get().setGroundPlaneEnabled(enabled);
    },

    setShadows(enabled: boolean) {
      get().setCesiumShadowsEnabled(enabled);
    },

    setLighting(enabled: boolean) {
      get().setCesiumLightingEnabled(enabled);
    },

    setSimulationTime(isoTime: string) {
      get().setCesiumCurrentTime(isoTime);
    },

    get(): SceneEnvironment {
      const s = get();
      return {
        basemap: s.basemapType,
        skybox: s.skyboxType,
        ambientLightIntensity: s.ambientLightIntensity,
        gridEnabled: s.gridEnabled,
        groundPlaneEnabled: s.groundPlaneEnabled,
        shadowsEnabled: s.cesiumShadowsEnabled,
        lightingEnabled: s.cesiumLightingEnabled,
        simulationTime: s.cesiumCurrentTime ?? undefined,
      };
    },
  };
}
