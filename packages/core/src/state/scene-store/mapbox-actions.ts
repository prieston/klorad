import type { MapboxSceneData } from "../../types/mapbox-scene";
import { DEFAULT_MAPBOX_SCENE_DATA } from "../../types/mapbox-scene";

export function createMapboxActions(set: any) {
  return {
    setMapboxMap: (map: unknown | null) => set({ mapboxMap: map }),
    setSelectedMapboxBuilding: (
      feature: {
        properties: Record<string, unknown>;
        lng?: number;
        lat?: number;
      } | null
    ) =>
      set(
        feature
          ? {
              selectedMapboxBuilding: feature,
              selectedObject: null,
              selectedObservation: null,
              selectedCesiumFeature: null,
            }
          : { selectedMapboxBuilding: null }
      ),
    setMapboxSceneData: (partial: Partial<MapboxSceneData>) =>
      set((state: { mapboxSceneData: MapboxSceneData }) => {
        const prev = state.mapboxSceneData;
        const def = DEFAULT_MAPBOX_SCENE_DATA;
        return {
          mapboxSceneData: {
            ...prev,
            ...partial,
            layers:
              partial.layers !== undefined ? partial.layers : prev.layers,
            floorPlanRasters:
              partial.floorPlanRasters !== undefined
                ? partial.floorPlanRasters
                : prev.floorPlanRasters,
            terrain:
              partial.terrain !== undefined
                ? { ...def.terrain!, ...prev.terrain, ...partial.terrain }
                : prev.terrain,
            fog:
              partial.fog !== undefined
                ? { ...def.fog!, ...prev.fog, ...partial.fog }
                : prev.fog,
            standardBasemap:
              partial.standardBasemap !== undefined
                ? {
                    ...def.standardBasemap!,
                    ...prev.standardBasemap,
                    ...partial.standardBasemap,
                  }
                : prev.standardBasemap,
          },
        };
      }),
    resetMapboxSceneData: () =>
      set({ mapboxSceneData: { ...DEFAULT_MAPBOX_SCENE_DATA } }),
  };
}
