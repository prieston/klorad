import { PanelConfiguration } from "../types/panelConfig";
import {
  createThreeJSLeftPanelConfig,
  createCesiumLeftPanelConfig,
} from "../panels/leftPanelConfig";
import {
  createThreeJSBottomPanelConfig,
  createCesiumBottomPanelConfig,
} from "../panels/bottomPanelConfig";
import {
  createThreeJSRightPanelConfig,
  createCesiumRightPanelConfig,
} from "../panels/rightPanelConfig";
import { getEngine } from "../utils/worldStore";

export const getLeftPanelConfig = (
  gridEnabled: boolean,
  setGridEnabled: (enabled: boolean) => void,
  skyboxType: "default" | "none",
  setSkyboxType: (type: "default" | "none") => void,
  ambientLightIntensity: number,
  setAmbientLightIntensity: (intensity: number) => void,
  basemapType?: "cesium" | "google" | "google-photorealistic" | "bing" | "none",
  setBasemapType?: (
    type: "cesium" | "google" | "google-photorealistic" | "bing" | "none"
  ) => void,
  worldStoreState?: any
): PanelConfiguration => {
  const engine = getEngine(worldStoreState);

  switch (engine) {
    case "three":
      return createThreeJSLeftPanelConfig(
        gridEnabled,
        setGridEnabled,
        skyboxType,
        setSkyboxType
      );
    case "cesium":
      return createCesiumLeftPanelConfig(
        gridEnabled,
        setGridEnabled,
        skyboxType,
        setSkyboxType,
        ambientLightIntensity,
        setAmbientLightIntensity,
        basemapType || "cesium",
        setBasemapType || (() => {})
      );
    default:
      return createThreeJSLeftPanelConfig(
        gridEnabled,
        setGridEnabled,
        skyboxType,
        setSkyboxType
      ); // Default to ThreeJS
  }
};

export const getBottomPanelConfig = (
  viewMode: string,
  setViewMode: (mode: string) => void,
  isPlaying: boolean,
  togglePlayback: () => void,
  observationPoints: any[],
  selectedObservation: any,
  addObservationPoint: () => void,
  selectObservation: (id: number) => void,
  deleteObservationPoint: (id: number) => void,
  nextObservation: () => void,
  prevObservation: () => void,
  previewMode: boolean,
  previewIndex: number,
  setPreviewIndex: (index: number) => void,
  setPreviewMode: (mode: boolean) => void,
  worldStoreState?: any,
  reorderObservationPoints?: (startIndex: number, endIndex: number) => void
): PanelConfiguration => {
  const engine = getEngine(worldStoreState);

  switch (engine) {
    case "three":
      return createThreeJSBottomPanelConfig(
        viewMode,
        setViewMode,
        isPlaying,
        togglePlayback,
        observationPoints,
        selectedObservation,
        addObservationPoint,
        selectObservation,
        deleteObservationPoint,
        nextObservation,
        prevObservation,
        previewMode,
        previewIndex,
        setPreviewIndex,
        setPreviewMode,
        reorderObservationPoints
      );
    case "cesium":
      return createCesiumBottomPanelConfig(
        viewMode,
        setViewMode,
        isPlaying,
        togglePlayback,
        observationPoints,
        selectedObservation,
        addObservationPoint,
        selectObservation,
        deleteObservationPoint,
        nextObservation,
        prevObservation,
        previewMode,
        previewIndex,
        setPreviewIndex,
        setPreviewMode,
        reorderObservationPoints
      );
    default:
      return createThreeJSBottomPanelConfig(
        viewMode,
        setViewMode,
        isPlaying,
        togglePlayback,
        observationPoints,
        selectedObservation,
        addObservationPoint,
        selectObservation,
        deleteObservationPoint,
        nextObservation,
        prevObservation,
        previewMode,
        previewIndex,
        setPreviewIndex,
        setPreviewMode,
        reorderObservationPoints
      ); // Default to ThreeJS
  }
};

export const getRightPanelConfig = (
  selectedObject: any,
  selectedObservation: any,
  viewMode: string,
  controlSettings: any,
  updateObjectProperty: (id: string, property: string, value: any) => void,
  updateObservationPoint: (id: number, update: any) => void,
  deleteObservationPoint: (id: number) => void,
  setCapturingPOV: (val: boolean) => void,
  updateControlSettings: (update: any) => void,
  worldStoreState?: any
): PanelConfiguration => {
  const engine = getEngine(worldStoreState);
  const { repositioning, onStartRepositioning, onCancelRepositioning } =
    worldStoreState || {};

  switch (engine) {
    case "three":
      return createThreeJSRightPanelConfig(
        selectedObject,
        selectedObservation,
        viewMode,
        controlSettings,
        updateObjectProperty,
        updateObservationPoint,
        deleteObservationPoint,
        setCapturingPOV,
        updateControlSettings,
        repositioning,
        onStartRepositioning,
        onCancelRepositioning
      );
    case "cesium":
      return createCesiumRightPanelConfig(
        selectedObject,
        selectedObservation,
        viewMode,
        controlSettings,
        updateObjectProperty,
        updateObservationPoint,
        deleteObservationPoint,
        setCapturingPOV,
        updateControlSettings,
        repositioning,
        onStartRepositioning,
        onCancelRepositioning
      );
    default:
      return createThreeJSRightPanelConfig(
        selectedObject,
        selectedObservation,
        viewMode,
        controlSettings,
        updateObjectProperty,
        updateObservationPoint,
        deleteObservationPoint,
        setCapturingPOV,
        updateControlSettings,
        repositioning,
        onStartRepositioning,
        onCancelRepositioning
      ); // Default to ThreeJS
  }
};

// Note: legacy getPanelConfig has been removed in favor of explicit
// getLeftPanelConfig/getRightPanelConfig/getBottomPanelConfig which
// accept required state parameters and route by engine.
