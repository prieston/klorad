import { useSceneStore } from "@klorad/core";
import type { AssetsAPI } from "../types/interfaces";
import type { SceneAsset } from "../types";

type RawAsset = ReturnType<typeof useSceneStore.getState>["cesiumIonAssets"][number];

function toSceneAsset(a: RawAsset): SceneAsset {
  return {
    id: a.id,
    name: a.name,
    assetId: a.assetId,
    apiKey: a.apiKey,
    enabled: a.enabled,
    transform: a.transform,
  };
}

export function createAssetsAPI(): AssetsAPI {
  const get = () => useSceneStore.getState();

  return {
    addIonAsset(asset): SceneAsset {
      get().addCesiumIonAsset(asset as RawAsset);
      const assets = get().cesiumIonAssets;
      return toSceneAsset(assets[assets.length - 1]);
    },

    removeIonAsset(id) {
      get().removeCesiumIonAsset(id);
    },

    toggleIonAsset(id) {
      get().toggleCesiumIonAsset(id);
    },

    updateIonAsset(id, patch) {
      get().updateCesiumIonAsset(id, patch as Partial<RawAsset>);
    },

    async flyToIonAsset(id) {
      get().flyToCesiumIonAsset(id);
    },

    getAll(): SceneAsset[] {
      return get().cesiumIonAssets.map(toSceneAsset);
    },
  };
}
