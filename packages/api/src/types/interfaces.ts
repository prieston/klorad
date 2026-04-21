import type { POI, POIInput, DataLayer } from "./campus";
import type {
  Engine,
  GeoPosition,
  ViewMode,
  TransformMode,
  Vector3,
  SceneObject,
  SceneObjectInput,
  SceneAsset,
  SceneData,
  TourStop,
  SceneEnvironment,
  SceneEventType,
  SceneEventHandler,
  SensorConfig,
  IoTConfig,
  ExhibitConfig,
  BasemapType,
  SkyboxType,
} from "./index";

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------

export interface CameraAPI {
  flyToObject(objectId: string, options?: { minDistance?: number }): Promise<void>;
  flyToPosition(position: GeoPosition, options?: { radius?: number; duration?: number }): Promise<void>;
  flyToAsset(assetId: string): Promise<void>;
  flyToTourStop(stopId: number): Promise<void>;
  reset(): void;
  setViewMode(mode: ViewMode): void;
  getPosition(): { position: Vector3; target: Vector3 };
  capturePose(): { position: Vector3; target: Vector3 };
}

// ---------------------------------------------------------------------------
// Objects
// ---------------------------------------------------------------------------

export interface ObjectsAPI {
  add(input: SceneObjectInput): SceneObject;
  remove(id: string): void;
  select(id: string): void;
  deselect(): void;
  setTransform(id: string, transform: Partial<Pick<SceneObject, "position" | "rotation" | "scale">>): void;
  update(id: string, patch: Partial<SceneObject>): void;
  reorder(fromIndex: number, toIndex: number): void;
  getAll(): SceneObject[];
  getById(id: string): SceneObject | null;
  setTransformMode(mode: TransformMode): void;
}

// ---------------------------------------------------------------------------
// Tour
// ---------------------------------------------------------------------------

export interface TourAPI {
  addStop(): TourStop;
  updateStop(id: number, patch: Partial<TourStop>): void;
  deleteStop(id: number): void;
  reorderStops(fromIndex: number, toIndex: number): void;
  play(options?: { speed?: number; loop?: boolean }): void;
  stop(): void;
  next(): void;
  prev(): void;
  goTo(index: number): void;
  getAll(): TourStop[];
  getCurrent(): TourStop | null;
}

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

export interface AssetsAPI {
  addIonAsset(asset: Omit<SceneAsset, "id">): SceneAsset;
  removeIonAsset(id: string): void;
  toggleIonAsset(id: string): void;
  updateIonAsset(id: string, patch: Partial<SceneAsset>): void;
  flyToIonAsset(id: string): Promise<void>;
  getAll(): SceneAsset[];
}

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

export interface EnvironmentAPI {
  setBasemap(type: BasemapType): void;
  setSkybox(type: SkyboxType): void;
  setAmbientLight(intensity: number): void;
  setGrid(enabled: boolean): void;
  setGroundPlane(enabled: boolean): void;
  setShadows(enabled: boolean): void;
  setLighting(enabled: boolean): void;
  setSimulationTime(isoTime: string): void;
  get(): SceneEnvironment;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export interface SceneEventBusAPI {
  on<T extends SceneEventType>(event: T, handler: SceneEventHandler<T>): () => void;
  off<T extends SceneEventType>(event: T, handler: SceneEventHandler<T>): void;
  emit<T extends SceneEventType>(event: T, payload: SceneEventMap[T]): void;
}

// Inline to avoid circular import
type SceneEventMap = import("./index").SceneEventMap;

// ---------------------------------------------------------------------------
// Root SceneAPI
// ---------------------------------------------------------------------------

export interface SceneAPI {
  readonly engine: Engine;
  readonly camera: CameraAPI;
  readonly objects: ObjectsAPI;
  readonly tour: TourAPI;
  readonly assets: AssetsAPI;
  readonly environment: EnvironmentAPI;
  readonly events: SceneEventBusAPI;
  load(data: SceneData): void;
  export(): SceneData;
  reset(): void;
}

// ---------------------------------------------------------------------------
// Domain: Digital Twin
// ---------------------------------------------------------------------------

export interface SensorsAPI {
  attach(objectId: string, config: SensorConfig): void;
  detach(objectId: string): void;
  computeViewshed(objectId: string): Promise<void>;
  update(objectId: string, patch: Partial<SensorConfig>): void;
}

export interface IoTAPI {
  attach(objectId: string, config: IoTConfig): void;
  detach(objectId: string): void;
  getData(objectId: string): Record<string, unknown> | null;
  startPolling(): void;
  stopPolling(): void;
}

export interface DigitalTwinAPI extends SceneAPI {
  readonly sensors: SensorsAPI;
  readonly iot: IoTAPI;
}

// ---------------------------------------------------------------------------
// Domain: Virtual Museum
// ---------------------------------------------------------------------------

export interface ExhibitsAPI {
  attach(objectId: string, config: ExhibitConfig): void;
  detach(objectId: string): void;
  update(objectId: string, patch: Partial<ExhibitConfig>): void;
  get(objectId: string): ExhibitConfig | null;
  toggleLabel(objectId: string, visible: boolean): void;
  getAll(): Array<{ objectId: string; config: ExhibitConfig }>;
}

export interface VirtualMuseumAPI extends SceneAPI {
  readonly exhibits: ExhibitsAPI;
}

// ---------------------------------------------------------------------------
// Domain: Campus / University Map
// ---------------------------------------------------------------------------

export interface POIManagerAPI {
  add(input: POIInput): POI;
  update(id: string, patch: Partial<POI>): void;
  remove(id: string): void;
  getAll(): POI[];
  search(query: string): POI[];
  flyTo(id: string): Promise<void>;
}

export interface LayersAPI {
  register(layer: DataLayer): void;
  toggle(layerId: string, visible: boolean): void;
  update(layerId: string, data: Record<string, unknown>): void;
  getAll(): DataLayer[];
}

export interface CampusAPI extends SceneAPI {
  readonly poi: POIManagerAPI;
  readonly layers: LayersAPI;
}
