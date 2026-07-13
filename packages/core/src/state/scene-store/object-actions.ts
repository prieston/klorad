import type { Model } from "./types";
import { createNewModel } from "./model-helpers";
import { updateObjectInArray } from "./object-updates";

export function createObjectActions(set: any, _get: any) {
  return {
    setObjects: (newObjects: Model[]) => set({ objects: newObjects }),

    addModel: (model: Partial<Model>) =>
      set((state: any) => {
        const camera = state.orbitControlsRef?.object;
        const newModel = createNewModel(model, state.scene, camera || null);
        return { objects: [...state.objects, newModel] };
      }),

    selectObject: (id: string, _ref: any) =>
      set((state: any) => {
        const found = state.objects.find((obj: Model) => obj.id === id);
        return {
          selectedObject: found ? (found as any) : null,
          selectedObservation: null,
          selectedMapboxBuilding: null,
        } as any;
      }),

    removeObject: (id: string) =>
      set((state: any) => {
        const objectToRemove = state.objects.find((obj: Model) => obj.id === id);
        const isCesiumIonAsset =
          objectToRemove?.type === "cesium-ion-tileset" ||
          objectToRemove?.type === "cesiumIonAsset";

        return {
          objects: state.objects.filter((obj: Model) => obj.id !== id),
          selectedObject:
            state.selectedObject?.id === id ? null : state.selectedObject,
          // Match the sidecar `CesiumIonAsset` row by the Cesium Ion
          // asset id — not the model's `assetId`, which stores the
          // *database* asset id (`model.id`) and never matches
          // `cesiumIonAsset.assetId` (the numeric Ion id). Without
          // this, deleting an Ion-backed model from the scene
          // removed it from the objects list but the tileset / data
          // source kept rendering because `CesiumIonAssetsRenderer`
          // still saw a live row in `cesiumIonAssets`.
          //
          // Falls back to a `name` match so historical rows added
          // before we started stamping `cesiumAssetId` on the Model
          // still delete cleanly.
          cesiumIonAssets: isCesiumIonAsset
            ? state.cesiumIonAssets.filter((asset: any) => {
                const cesiumId = (objectToRemove as {
                  cesiumAssetId?: string;
                })?.cesiumAssetId;
                if (cesiumId && String(asset.assetId) === String(cesiumId)) {
                  return false;
                }
                if (
                  objectToRemove?.name &&
                  asset.name === objectToRemove.name
                ) {
                  return false;
                }
                return true;
              })
            : state.cesiumIonAssets,
        };
      }),

    updateObjectProperty: (id: string, property: string, value: any) => {
      set((state: any) => {
        const updatedObjects = updateObjectInArray(
          state.objects,
          id,
          property,
          value
        );
        const updatedSelectedObject =
          state.selectedObject?.id === id
            ? updatedObjects.find((obj: Model) => obj.id === id)
            : state.selectedObject;
        return { objects: updatedObjects, selectedObject: updatedSelectedObject };
      });
    },

    updateModelRef: (id: string, _ref: any) =>
      set((state: any) => ({
        objects: state.objects.map((obj: Model) =>
          obj.id === id ? { ...obj, ref: _ref } : obj
        ),
      })),

    deselectObject: () =>
      set({ selectedObject: null, selectedMapboxBuilding: null }),

    setModelPosition: (id: string, newPosition: any) =>
      set((state: any) => ({
        objects: state.objects.map((obj: Model) =>
          obj.id === id
            ? {
                ...obj,
                position: newPosition.toArray() as [number, number, number],
              }
            : obj
        ),
      })),

    setModelRotation: (id: string, newRotation: any) =>
      set((state: any) => ({
        objects: state.objects.map((obj: Model) =>
          obj.id === id
            ? {
                ...obj,
                rotation: [newRotation.x, newRotation.y, newRotation.z] as [
                  number,
                  number,
                  number,
                ],
              }
            : obj
        ),
      })),

    setModelScale: (id: string, newScale: any) =>
      set((state: any) => ({
        objects: state.objects.map((obj: Model) =>
          obj.id === id
            ? {
                ...obj,
                scale: [newScale.x, newScale.y, newScale.z] as [
                  number,
                  number,
                  number,
                ],
              }
            : obj
        ),
      })),

    reorderObjects: (startIndex: number, endIndex: number) =>
      set((state: any) => {
        const newObjects = [...state.objects];
        const [removed] = newObjects.splice(startIndex, 1);
        newObjects.splice(endIndex, 0, removed);

        return {
          objects: newObjects,
          selectedObject: newObjects.find((obj: Model) => obj.id === state.selectedObject?.id) || state.selectedObject,
        };
      }),

  };
}

