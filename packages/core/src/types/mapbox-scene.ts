/**
 * Mapbox engine scene payload (persisted under sceneData.mapbox).
 * Observation points for this engine use position/target as [lng, lat, altitudeMeters].
 */
export type MapboxProjection = "mercator" | "globe";

export type MapboxLngLat = [number, number];

export interface MapboxSceneLayer {
  id: string;
  name?: string;
  type: "geojson-fill" | "geojson-line" | "geojson-circle" | "fill-extrusion";
  visible?: boolean;
  geojson?: unknown;
  /** Fetched at runtime in the Mapbox viewer when `geojson` is absent. */
  geojsonUrl?: string;
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
  fillExtrusionHeight?: number;
  fillExtrusionBase?: number;
  filter?: unknown[];
}

/**
 * A room polygon belonging to a specific building and floor. Rendered as
 * a fill-extrusion so it floats at the correct elevation for that floor.
 */
export interface MapboxRoom {
  id: string;
  name: string;
  roomNumber?: string;
  type: string;
  templateId?: string;
  /** POI id of the building this room belongs to. */
  buildingId: string;
  /** Floor index — 0 = ground, 1 = first, -1 = basement. */
  floor: number;
  /** Closed polygon ring in [lng, lat], first and last points equal. */
  polygon: MapboxLngLat[];
  /** Extrusion height in meters (defaults to ~3m per floor). */
  heightM?: number;
  icon?: string;
  color?: string;
  occupants?: Array<{ name: string; role?: string; email?: string }>;
  scheduleUrl?: string;
  visible?: boolean;
}

/** Georeferenced floor plan / overlay (Mapbox image source). */
export interface MapboxFloorPlanRaster {
  id: string;
  name?: string;
  url: string;
  /** Image corners as [top-left, top-right, bottom-right, bottom-left] per Mapbox image sources. */
  coordinates: [MapboxLngLat, MapboxLngLat, MapboxLngLat, MapboxLngLat];
  /** Links the plan to a specific building. Matches a POI's `linkedBuilding.featureId`
   *  or a stable custom string chosen by the admin. */
  buildingId?: string;
  /** Floor index or label. Use 0 for ground (label as "Γ"), positive ints for upper levels. */
  floor?: number;
  /** Toggle visibility without removing the plan. Defaults to true. */
  visible?: boolean;
}

/**
 * Mapbox Standard / Standard Satellite basemap import (`setConfigProperty`).
 * @see https://docs.mapbox.com/map-styles/standard/api/
 */
export interface MapboxStandardBasemapConfig {
  /** Style import id (usually `basemap`). */
  importId?: string;
  theme?: "default" | "faded" | "monochrome" | "custom";
  /** Time-of-day lighting preset (shadows / fill light on 3D). */
  lightPreset?: "dawn" | "day" | "dusk" | "night";
  show3dObjects?: boolean;
  show3dBuildings?: boolean;
  show3dTrees?: boolean;
  show3dLandmarks?: boolean;
  showPedestrianRoads?: boolean;
  showPlaceLabels?: boolean;
  showPointOfInterestLabels?: boolean;
  showRoadLabels?: boolean;
  showTransitLabels?: boolean;
  showAdminBoundaries?: boolean;
}

export interface MapboxTerrainSettings {
  enabled: boolean;
  /** Vertical exaggeration (Mapbox DEM). */
  exaggeration: number;
}

export interface MapboxFogSettings {
  enabled: boolean;
  color?: string;
  highColor?: string;
  horizonBlend?: number;
  spaceColor?: string;
  starIntensity?: number;
  /** Near / far range for fog ramp. */
  range?: [number, number];
}

export interface MapboxSceneData {
  styleUrl: string;
  center: MapboxLngLat;
  zoom: number;
  pitch: number;
  bearing: number;
  maxBounds?: [MapboxLngLat, MapboxLngLat];
  layers: MapboxSceneLayer[];
  floorPlanRasters?: MapboxFloorPlanRaster[];
  rooms?: MapboxRoom[];

  projection?: MapboxProjection;
  terrain?: MapboxTerrainSettings;
  fog?: MapboxFogSettings;
  /** Mapbox Standard style fragment config (no-op on classic raster/vector styles). */
  standardBasemap?: MapboxStandardBasemapConfig;
}

export const DEFAULT_MAPBOX_SCENE_DATA: MapboxSceneData = {
  styleUrl: "mapbox://styles/mapbox/standard",
  center: [23.7275, 37.9838],
  zoom: 16,
  pitch: 45,
  bearing: 0,
  layers: [],
  floorPlanRasters: [],
  rooms: [],
  projection: "mercator",
  terrain: {
    enabled: false,
    exaggeration: 1.2,
  },
  fog: {
    enabled: true,
    color: "rgb(186, 214, 234)",
    highColor: "#245bde",
    horizonBlend: 0.15,
    spaceColor: "#4a5b7a",
    starIntensity: 0,
    range: [0.8, 8],
  },
  standardBasemap: {
    importId: "basemap",
    theme: "default",
    lightPreset: "day",
    show3dObjects: true,
    show3dBuildings: true,
    show3dTrees: true,
    show3dLandmarks: true,
    showPedestrianRoads: true,
    showPlaceLabels: true,
    showPointOfInterestLabels: true,
    showRoadLabels: true,
    showTransitLabels: true,
    showAdminBoundaries: false,
  },
};
