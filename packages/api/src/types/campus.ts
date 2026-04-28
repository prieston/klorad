import type { Vector3 } from "./index";

export type POICategory =
  | "building" | "department" | "library" | "dining"
  | "parking" | "sports" | "medical" | "admin" | "housing"
  | "amenity" | "custom";

export type MediaType = "image" | "video" | "audio" | "document";

export interface POIMedia {
  type: MediaType;
  url: string;
  caption?: string;
}

export interface AccessibilityInfo {
  wheelchairAccessible: boolean;
  elevatorAvailable?: boolean;
  notes?: string;
}

export interface POIView {
  zoom?: number;
  pitch?: number;
  bearing?: number;
}

export interface POIEvent {
  id: string;
  /** Primary label — course title, session name, or event name. */
  title: string;
  /** ISO timestamp. */
  startsAt: string;
  /** ISO timestamp. */
  endsAt: string;
  /** Course code such as "BIO 101" — indexed by search. */
  courseCode?: string;
  /** Lecturer / speaker / host. */
  lecturer?: string;
  /** Optional extra detail shown on the event card. */
  description?: string;
}

export interface POILinkedBuilding {
  /** Feature id from the Mapbox layer, if available (used for feature-state highlight). */
  featureId?: string | number;
  /** Longitude of the clicked building centroid/click point. */
  lng: number;
  /** Latitude of the clicked building centroid/click point. */
  lat: number;
  /** Raw Mapbox feature properties (name, height, etc.). */
  properties?: Record<string, unknown>;
  /** Optional user-provided label shown in the panel. */
  label?: string;
  /**
   * Closed polygon ring in [lng, lat] when this building was traced by
   * the user (no underlying Mapbox feature). When set, the campus
   * renderer draws a fill-extrusion using `heightM` instead of relying
   * on the basemap's `building` layer.
   */
  polygon?: [number, number][];
  /** Extrusion height in metres for user-drawn buildings. */
  heightM?: number;
}

export interface POI {
  id: string;
  name: string;
  objectId: string;
  position: Vector3;
  category?: POICategory;
  description?: string;
  media?: POIMedia[];
  tags?: string[];
  hours?: string;
  floor?: number;
  accessibility?: AccessibilityInfo;
  /** Camera framing when flying to this POI. */
  view?: POIView;
  /** Optional link to a Mapbox building feature (or user-drawn building). */
  linkedBuilding?: POILinkedBuilding;
  /** Scheduled events happening at this POI (lectures, workshops, tours). */
  events?: POIEvent[];
}

export type POIInput = Omit<POI, "id" | "objectId"> & { id?: string };

export type DataLayerType =
  | "occupancy" | "events" | "parking" | "dining"
  | "accessibility" | "emergency" | "custom";

export interface DataLayer {
  id: string;
  name: string;
  type: DataLayerType;
  visible: boolean;
  data: Record<string, unknown>;
}
