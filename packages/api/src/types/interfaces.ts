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
  load(data: Partial<SceneData>): void;
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

export interface FloorPlan {
  id: string;
  name?: string;
  url: string;
  /** [top-left, top-right, bottom-right, bottom-left] as [lng, lat]. */
  coordinates: [[number, number], [number, number], [number, number], [number, number]];
  buildingId?: string;
  floor?: number;
  visible?: boolean;
}

export type FloorPlanInput = Omit<FloorPlan, "id"> & { id?: string };

export interface FloorPlansAPI {
  add(input: FloorPlanInput): FloorPlan;
  update(id: string, patch: Partial<FloorPlan>): void;
  remove(id: string): void;
  setVisible(id: string, visible: boolean): void;
  getAll(): FloorPlan[];
  /** Return plans for a given building, sorted by floor asc. */
  forBuilding(buildingId: string): FloorPlan[];
}

/**
 * Room types used for default rendering (color, icon) and filtering.
 * Kept as a plain string union so consumers can extend without breaking
 * the schema — anything unknown renders with a neutral style.
 */
export type RoomType =
  | "office"
  | "classroom"
  | "lab"
  | "amphitheatre"
  | "library"
  | "cafe"
  | "wc"
  | "utility"
  | "corridor"
  | "other";

export interface RoomOccupant {
  /** Person's name ("Prof. Papadopoulos"). */
  name: string;
  /** Role / title ("Associate Professor", "Head of Department"). */
  role?: string;
  /** Contact email — optional, used only by authenticated dashboards. */
  email?: string;
}

export interface Room {
  id: string;
  /** Short display name shown on the click-to-focus card ("Office 204"). */
  name: string;
  /** Room-number label if the university uses one ("B3-204"). */
  roomNumber?: string;
  type: RoomType;
  /** Optional reference to a Room Template (for styling defaults). */
  templateId?: string;
  /**
   * Linked POI id — almost always the POI that represents the building.
   * Used to keep the room's polygon associated with its building so the
   * Level Switcher can filter by selected building.
   */
  buildingId: string;
  /** Floor index — 0 = ground, 1 = first, -1 = basement, etc. */
  floor: number;
  /** Closed polygon ring in [lng, lat]. First and last points equal. */
  polygon: [number, number][];
  /** Extrusion height in meters. Defaults to 3m per floor. */
  heightM?: number;
  /** Optional icon override. */
  icon?: string;
  /** Optional hex color override (else derived from `type`). */
  color?: string;
  /** Occupants shown on the room card — professors, departments, etc. */
  occupants?: RoomOccupant[];
  /** ICS URL / integration endpoint for live schedule (Phase B). */
  scheduleUrl?: string;
  /** Admin-facing hidden flag. */
  visible?: boolean;
}

export type RoomInput = Omit<Room, "id"> & { id?: string };

export interface RoomsAPI {
  add(input: RoomInput): Room;
  update(id: string, patch: Partial<Room>): void;
  remove(id: string): void;
  setVisible(id: string, visible: boolean): void;
  getAll(): Room[];
  /** Rooms for a given building, sorted by floor asc. */
  forBuilding(buildingId: string): Room[];
  /** Rooms for a given building on a specific floor. */
  forFloor(buildingId: string, floor: number): Room[];
}

export interface CampusAPI extends SceneAPI {
  readonly poi: POIManagerAPI;
  readonly layers: LayersAPI;
  readonly floorPlans: FloorPlansAPI;
  readonly rooms: RoomsAPI;
  /** Re-center the campus map on a new location (persisted on save). */
  setLocation(lng: number, lat: number, options?: { zoom?: number; pitch?: number; bearing?: number; fly?: boolean }): void;
}
