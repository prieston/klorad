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
