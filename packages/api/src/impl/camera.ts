import { useSceneStore } from "@klorad/core";
import type { CameraAPI } from "../types/interfaces";
import type { GeoPosition, ViewMode, Vector3 } from "../types";

export function createCameraAPI(): CameraAPI {
  const get = () => useSceneStore.getState();

  return {
    async flyToObject(objectId, _options) {
      get().selectObject(objectId, null);
    },

    async flyToPosition(position: GeoPosition, _options) {
      get().setSelectedLocation({
        latitude: position.latitude,
        longitude: position.longitude,
      });
    },

    async flyToAsset(assetId: string) {
      get().flyToCesiumIonAsset(assetId);
    },

    async flyToTourStop(stopId: number) {
      get().selectObservation(stopId);
    },

    reset() {
      get().setSelectedLocation(null);
      get().deselectObject();
    },

    setViewMode(mode: ViewMode) {
      get().setViewMode(mode as ReturnType<typeof useSceneStore.getState>["viewMode"]);
    },

    getPosition(): { position: Vector3; target: Vector3 } {
      const controls = get().orbitControlsRef;
      if (controls) {
        const cam = (controls as { object: { position: { x: number; y: number; z: number } }; target: { x: number; y: number; z: number } });
        return {
          position: [cam.object.position.x, cam.object.position.y, cam.object.position.z],
          target: [cam.target.x, cam.target.y, cam.target.z],
        };
      }
      return { position: [0, 0, 0], target: [0, 0, 0] };
    },

    capturePose() {
      return this.getPosition();
    },
  };
}
