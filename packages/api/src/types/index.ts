// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export type Engine = "three" | "cesium";
export type SceneMode = "editor" | "digital-twin" | "museum" | "viewer";
export type Vector3 = [number, number, number];
export type TransformMode = "translate" | "rotate" | "scale";
export type ViewMode = "orbit" | "firstPerson" | "flight" | "car" | "thirdPerson";

export type GeoPosition = {
  longitude: number;
  latitude: number;
  altitude?: number;
};

// ---------------------------------------------------------------------------
// Scene Object
// Domain layers extend SceneObject.meta with their own typed metadata.
// ---------------------------------------------------------------------------

export interface SceneObject {
  id: string;
  name: string;
  url?: string;
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
  type: "model" | "tileset" | "primitive" | "component";
  interactable: boolean;
  visible: boolean;
  meta?: Record<string, unknown>;
}

export type SceneObjectInput = Omit<SceneObject, "id"> & { id?: string };

// ---------------------------------------------------------------------------
// Tour Stop (observation point / guided camera waypoint)
// ---------------------------------------------------------------------------

export interface TourStop {
  id: number;
  title: string;
  description: string;
  cameraPosition: Vector3 | null;
  cameraTarget: Vector3 | null;
  linkedObjectId?: string;
}

// ---------------------------------------------------------------------------
// Scene Asset (Cesium Ion reference or external tileset)
// ---------------------------------------------------------------------------

export interface SceneAsset {
  id: string;
  name: string;
  assetId?: string;
  apiKey?: string;
  enabled: boolean;
  transform?: {
    matrix: number[];
    longitude?: number;
    latitude?: number;
    height?: number;
  };
}

// ---------------------------------------------------------------------------
// Scene Data  (serialisable — stored in DB as Project.sceneData)
// ---------------------------------------------------------------------------

export type BasemapType = "cesium" | "google" | "google-photorealistic" | "bing" | "none";
export type SkyboxType = "default" | "none";

export interface SceneEnvironment {
  basemap: BasemapType;
  skybox: SkyboxType;
  ambientLightIntensity: number;
  gridEnabled: boolean;
  groundPlaneEnabled: boolean;
  shadowsEnabled: boolean;
  lightingEnabled: boolean;
  simulationTime?: string;
}

export interface SceneData {
  objects: SceneObject[];
  tourStops: TourStop[];
  assets: SceneAsset[];
  environment: SceneEnvironment;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type SceneEventMap = {
  "object:select":   { object: SceneObject };
  "object:deselect": Record<string, never>;
  "object:add":      { object: SceneObject };
  "object:remove":   { id: string };
  "object:move":     { id: string; position: Vector3 };
  "tour:start":      Record<string, never>;
  "tour:stop":       Record<string, never>;
  "tour:change":     { stop: TourStop };
  "scene:change":    { data: SceneData };
  "scene:save":      { data: SceneData };
};

export type SceneEventType = keyof SceneEventMap;
export type SceneEventHandler<T extends SceneEventType> = (
  payload: SceneEventMap[T]
) => void;

// ---------------------------------------------------------------------------
// Domain: Digital Twin
// ---------------------------------------------------------------------------

export type SensorShape = "cone" | "rectangle" | "dome";

export interface SensorConfig {
  shape: SensorShape;
  fov?: number;
  fovH?: number;
  fovV?: number;
  range: number;
  color?: string;
  showGeometry?: boolean;
  showViewshed?: boolean;
  viewshedOpacity?: number;
  analysisQuality?: "low" | "medium" | "high";
}

export interface IoTConfig {
  serviceType: string;
  apiEndpoint: string;
  updateInterval: number;
  displayFormat: "compact" | "detailed" | "minimal";
  autoRefresh: boolean;
}

// ---------------------------------------------------------------------------
// Domain: Virtual Museum
// ---------------------------------------------------------------------------

export type MediaType = "image" | "video" | "audio" | "document";

export interface ExhibitMedia {
  type: MediaType;
  url: string;
  caption?: string;
}

export interface ExhibitConfig {
  title: string;
  description: string;
  artist?: string;
  year?: string;
  media: ExhibitMedia[];
  labelVisible: boolean;
}
