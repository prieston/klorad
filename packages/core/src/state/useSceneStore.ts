import { createWithEqualityFn as create } from "zustand/traditional";
import type { SceneState } from "./scene-store/types";
import { createObjectActions } from "./scene-store/object-actions";
import { createObservationActions } from "./scene-store/observation-actions";
import { createCesiumActions } from "./scene-store/cesium-actions";

const useSceneStore = create<SceneState>((set, get) => ({
  // Initial state
  objects: [],
  observationPoints: [],
  selectedObject: null,
  selectedObservation: null,
  selectedCesiumFeature: null,
  selectedAssetId: "2275207",
  selectedLocation: null,
  orbitControlsRef: null,
  scene: null,
  tilesRenderer: null,
  cesiumIonAssets: [],
  cesiumViewer: null,
  cesiumInstance: null,
  basemapType: "none",
  gridEnabled: true,
  groundPlaneEnabled: false,
  ambientLightIntensity: 0.5,
  skyboxType: "default",
  showTiles: false,
  magnetEnabled: false,
  viewMode: "orbit",
  isThirdPerson: false,
  isPlaying: false,
  playbackSpeed: 1,
  previewIndex: 0,
  addingObservation: false,
  capturingPOV: false,
  previewMode: false,
  transformMode: "translate",
  bottomPanelVisible: false,
  cesiumLightingEnabled: false,
  cesiumShadowsEnabled: false,
  cesiumCurrentTime: null,
  controlSettings: {
    carSpeed: 54,
    walkSpeed: 20,
    flightSpeed: 100,
    turnSpeed: 0.02,
    smoothness: 0.05,
  },
  isCalculatingVisibility: false,
  lastVisibilityCalculation: null,
  selectingPosition: false,
  onPositionSelected: null,

  // Simple setters
  setGridEnabled: (enabled) => set({ gridEnabled: enabled }),
  setGroundPlaneEnabled: (enabled) => set({ groundPlaneEnabled: enabled }),
  setAmbientLightIntensity: (intensity) =>
    set({ ambientLightIntensity: intensity }),
  setSkyboxType: (type) => set({ skyboxType: type }),
  setShowTiles: (show) => set({ showTiles: show }),
  setMagnetEnabled: (enabled) => set({ magnetEnabled: enabled }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  setPreviewIndex: (index) => set({ previewIndex: index }),
  setPreviewMode: (value) => set({ previewMode: value }),
  setTransformMode: (mode) => set({ transformMode: mode }),
  setBottomPanelVisible: (visible) => set({ bottomPanelVisible: visible }),
  setOrbitControlsRef: (ref) => set({ orbitControlsRef: ref }),
  setScene: (scene) => set({ scene }),
  setSelectedAssetId: (assetId) => set({ selectedAssetId: assetId }),
  setSelectedLocation: (location) => set({ selectedLocation: location }),
  setSelectingPosition: (selecting) =>
    set((state) => {
      // Only update if value actually changed
      if (state.selectingPosition === selecting) return state;
      return { selectingPosition: selecting };
    }),
  setOnPositionSelected: (callback) =>
    set((state) => {
      // Don't compare function references - just update if callback is provided/changed
      // Compare by checking if both are null/undefined or both are functions
      const currentIsNull = !state.onPositionSelected;
      const newIsNull = !callback;
      if (currentIsNull && newIsNull) return state;
      // Always update if one is null and the other isn't, or if both are functions
      return { onPositionSelected: callback };
    }),
  startVisibilityCalculation: (objectId) =>
    set({
      isCalculatingVisibility: true,
      lastVisibilityCalculation: { objectId, timestamp: Date.now() },
    }),
  finishVisibilityCalculation: (_objectId) =>
    set({ isCalculatingVisibility: false }),
  updateControlSettings: (settings) =>
    set((state) => ({
      controlSettings: { ...state.controlSettings, ...settings },
    })),

  // Playback toggle
  togglePlayback: () =>
    set((state) => {
      const newIsPlaying = !state.isPlaying;
      const updates: Partial<SceneState> = {
        isPlaying: newIsPlaying,
        previewMode: newIsPlaying,
      };

      if (
        newIsPlaying &&
        !state.selectedObservation &&
        state.observationPoints.length > 0
      ) {
        updates.selectedObservation = state.observationPoints[0];
        updates.previewIndex = 0;
      }

      return updates;
    }),

  // Reset scene
  resetScene: () =>
    set({
      objects: [],
      observationPoints: [],
      selectedObject: null,
      selectedObservation: null,
      selectedAssetId: "2275207",
      selectedLocation: null,
      previewMode: false,
      previewIndex: 0,
      gridEnabled: true,
      groundPlaneEnabled: false,
      ambientLightIntensity: 0.5,
      skyboxType: "default",
      viewMode: "orbit",
      isPlaying: false,
      playbackSpeed: 1,
      tilesRenderer: null,
      cesiumIonAssets: [],
      cesiumLightingEnabled: false,
      cesiumShadowsEnabled: false,
      cesiumCurrentTime: null,
    }),

  // Object actions
  ...createObjectActions(set, get),

  // Observation point actions
  ...createObservationActions(set),

  // Cesium actions
  ...createCesiumActions(set, get),
}));

export default useSceneStore;
export type { SceneState } from "./scene-store/types";
export type { Model, ObservationPoint, ViewMode, CesiumIonAsset } from "./scene-store/types";
