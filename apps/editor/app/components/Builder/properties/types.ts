export type Vector3Tuple = [number, number, number];

export interface ControlSettings {
  carSpeed: number;
  walkSpeed: number;
  flightSpeed: number;
  turnSpeed: number;
  smoothness: number;
}

export interface ModelObject {
  id: string;
  name?: string;
  type?: string;
  assetId?: string;
  position?: Vector3Tuple;
  rotation?: Vector3Tuple;
  scale?: Vector3Tuple;
  material?: {
    color?: string;
  };
  isObservationModel?: boolean;
  observationProperties?: ObservationProperties;
  iotProperties?: IoTProperties;
  [key: string]: unknown;
}

export interface ObservationProperties {
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
  [key: string]: unknown;
}

export interface IoTProperties {
  enabled: boolean;
  serviceType: string;
  apiEndpoint: string;
  updateInterval: number;
  showInScene: boolean;
  displayFormat: "compact" | "detailed" | "minimal";
  autoRefresh: boolean;
}

export interface ObservationPoint {
  id: number;
  title: string;
  position?: Vector3Tuple;
  target?: Vector3Tuple;
  rotation?: Vector3Tuple;
  scale?: Vector3Tuple;
  fov?: number;
  showVisibleArea?: boolean;
  showActualArea?: boolean;
  visibilityRadius?: number;
  connectedModelId?: string;
  [key: string]: unknown;
}

export interface GeographicCoords {
  latitude: number;
  longitude: number;
  altitude: number;
}
