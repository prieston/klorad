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
