import * as THREE from "three";
import type { Vector3 } from "three";

export interface CesiumIonAsset {
  id: string;
  name: string;
  apiKey: string;
  assetId: string;
  enabled: boolean;
  transform?: {
    matrix: number[]; // 16-element array representing Matrix4
    longitude?: number;
    latitude?: number;
    height?: number;
  };
}

export interface Model {
  id: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  name?: string;
  url?: string;
  type?: string;
  apiKey?: string;
  assetId?: string;
  component?: string;
  material?: {
    color?: string;
    [key: string]: any;
  };
  isObservationModel?: boolean;
  observationProperties?: {
    sensorType: "cone" | "rectangle";
    fov: number;
    fovH?: number;
    fovV?: number;
    visibilityRadius: number;
    showSensorGeometry: boolean;
    showViewshed: boolean;
    sensorColor?: string;
    viewshedColor?: string;
    viewshedOpacity?: number; // 0-1 opacity for viewshed colors (default: 0.35)
    analysisQuality: "low" | "medium" | "high";
    raysAzimuth?: number;
    raysElevation?: number;
    clearance?: number;
    stepCount?: number;
    enableTransformEditor: boolean;
    alignWithModelFront: boolean;
    manualFrontDirection?: "x" | "y" | "z" | "negX" | "negY" | "negZ";
    include3DModels?: boolean;
    modelFrontAxis?: "X+" | "X-" | "Y+" | "Y-" | "Z+" | "Z-";
    sensorForwardAxis?: "X+" | "X-" | "Y+" | "Y-" | "Z+" | "Z-";
    tiltDeg?: number;
  };
  iotProperties?: {
    enabled: boolean;
    serviceType: string;
    apiEndpoint: string;
    updateInterval: number;
    showInScene: boolean;
    displayFormat: "compact" | "detailed" | "minimal";
    autoRefresh: boolean;
  };
  // Note: weatherData is now stored separately in IoT store (useIoTStore)
  // This prevents IoT updates from causing re-renders of scene objects
  [key: string]: any;
}

export interface ObservationPoint {
  id: number;
  title: string;
  description: string;
  position: [number, number, number] | null;
  target: [number, number, number] | null;
}

export type ViewMode =
  | "orbit"
  | "explore"
  | "firstPerson"
  | "thirdPerson"
  | "flight"
  | "thirdPersonFlight"
  | "car"
  | "thirdPersonCar"
  | "settings";

export interface SceneState {
  objects: Model[];
  observationPoints: ObservationPoint[];
  selectedObject: Model | null;
  selectedObservation: ObservationPoint | null;
  selectedCesiumFeature: {
    properties: Record<string, unknown>;
    worldPosition?: any;
    drillPickCount?: number;
  } | null;
  selectedAssetId: string;
  selectedLocation: {
    latitude: number;
    longitude: number;
    altitude?: number;
  } | null;
  tilesRenderer: any | null;
  cesiumIonAssets: CesiumIonAsset[];
  cesiumViewer: any | null;
  cesiumInstance: any | null;
  basemapType: "cesium" | "google" | "google-photorealistic" | "bing" | "none";
  gridEnabled: boolean;
  groundPlaneEnabled: boolean;
  ambientLightIntensity: number;
  skyboxType: "default" | "none";
  showTiles: boolean;
  magnetEnabled: boolean;
  cesiumLightingEnabled: boolean;
  cesiumShadowsEnabled: boolean;
  cesiumCurrentTime: string | null;
  viewMode: ViewMode;
  isThirdPerson: boolean;
  isPlaying: boolean;
  playbackSpeed: number;
  setPreviewIndex: (index: number) => void;
  addingObservation: boolean;
  capturingPOV: boolean;
  previewMode: boolean;
  previewIndex: number;
  transformMode: "translate" | "rotate" | "scale";
  bottomPanelVisible: boolean;
  orbitControlsRef: any | null;
  scene: THREE.Scene | null;
  setGridEnabled: (enabled: boolean) => void;
  setGroundPlaneEnabled: (enabled: boolean) => void;
  setAmbientLightIntensity: (intensity: number) => void;
  setSkyboxType: (type: "default" | "none") => void;
  setShowTiles: (show: boolean) => void;
  setMagnetEnabled: (enabled: boolean) => void;
  setCesiumViewer: (viewer: any) => void;
  setCesiumInstance: (instance: any) => void;
  setBasemapType: (
    type: "cesium" | "google" | "google-photorealistic" | "bing" | "none"
  ) => void;
  setViewMode: (mode: ViewMode) => void;
  togglePlayback: () => void;
  setPlaybackSpeed: (speed: number) => void;
  setCesiumLightingEnabled: (enabled: boolean) => void;
  setCesiumShadowsEnabled: (enabled: boolean) => void;
  setCesiumCurrentTime: (time: string | null) => void;
  setPreviewMode: (value: boolean) => void;
  setTransformMode: (mode: "translate" | "rotate" | "scale") => void;
  setBottomPanelVisible: (visible: boolean) => void;
  setObjects: (newObjects: Model[]) => void;
  addModel: (model: Partial<Model>) => void;
  selectObject: (id: string, ref: THREE.Object3D | null) => void;
  removeObject: (id: string) => void;
  updateObjectProperty: (id: string, property: string, value: any) => void;
  updateModelRef: (id: string, ref: THREE.Object3D | null) => void;
  deselectObject: () => void;
  setModelPosition: (id: string, newPosition: Vector3) => void;
  setModelRotation: (id: string, newRotation: Vector3) => void;
  setModelScale: (id: string, newScale: Vector3) => void;
  reorderObjects: (startIndex: number, endIndex: number) => void;
  setObservationPoints: (newPoints: ObservationPoint[]) => void;
  addObservationPoint: () => void;
  selectObservation: (id: number | null) => void;
  updateObservationPoint: (
    id: number,
    updates: Partial<ObservationPoint>
  ) => void;
  deleteObservationPoint: (id: number) => void;
  reorderObservationPoints: (startIndex: number, endIndex: number) => void;
  setCapturingPOV: (value: boolean) => void;
  startPreview: () => void;
  exitPreview: () => void;
  nextObservation: () => void;
  prevObservation: () => void;
  resetScene: () => void;
  setOrbitControlsRef: (ref: any) => void;
  setScene: (scene: THREE.Scene) => void;
  setTilesRenderer: (renderer: any) => void;
  addGoogleTiles: (apiKey: string) => void;
  addCesiumIonTiles: () => void;
  setSelectedAssetId: (assetId: string) => void;
  setSelectedLocation: (
    location: { latitude: number; longitude: number } | null
  ) => void;
  controlSettings: {
    carSpeed: number;
    walkSpeed: number;
    flightSpeed: number;
    turnSpeed: number;
    smoothness: number;
  };
  updateControlSettings: (
    settings: Partial<SceneState["controlSettings"]>
  ) => void;
  isCalculatingVisibility: boolean;
  lastVisibilityCalculation: { objectId: string; timestamp: number } | null;
  startVisibilityCalculation: (objectId: string) => void;
  finishVisibilityCalculation: (objectId: string) => void;
  addCesiumIonAsset: (asset: Omit<CesiumIonAsset, "id">) => void;
  removeCesiumIonAsset: (id: string) => void;
  updateCesiumIonAsset: (id: string, updates: Partial<CesiumIonAsset>) => void;
  toggleCesiumIonAsset: (id: string) => void;
  setCesiumIonAssets: (assets: CesiumIonAsset[]) => void;
  flyToCesiumIonAsset: (assetId: string) => void;
  setSelectedCesiumFeature: (
    feature: {
      properties: Record<string, unknown>;
      worldPosition?: any;
      drillPickCount?: number;
    } | null
  ) => void;
  selectingPosition: boolean;
  onPositionSelected: ((position: [number, number, number]) => void) | null;
  setSelectingPosition: (selecting: boolean) => void;
  setOnPositionSelected: (
    callback: ((position: [number, number, number]) => void) | null
  ) => void;
}
