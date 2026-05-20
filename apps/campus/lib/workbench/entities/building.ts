import type { EntityType } from "@klorad/config/workbench";
import { identitySchema } from "../schema";

/**
 * A building as a first-class campus entity. Today the codebase stores
 * the same shape nested inside `POI.linkedBuilding`; the Workbench
 * promotes it to a peer of POI so:
 *
 * - Multiple POIs can reference the same building without duplication.
 * - Buildings can be authored independently of any POI.
 * - Floor plans attach to a building, not to a POI.
 *
 * Defined here rather than imported from `@klorad/api` because no
 * standalone `Building` type exists there yet — the Workbench is the
 * first place that needs one.
 */
export interface Building {
  id: string;
  /** Display label shown in panels and on hover. */
  name: string;
  /** Centroid as [lng, lat] — used to fly to the building. */
  centroid: [number, number];
  /**
   * Closed polygon ring in [lng, lat]. When set, the renderer draws a
   * fill-extrusion using `heightM`. When absent, the building is
   * derived from a Mapbox basemap feature via `mapboxFeatureId`.
   */
  polygon?: [number, number][];
  /** Extrusion height in metres. */
  heightM?: number;
  /** Mapbox feature id when the building is derived from the basemap. */
  mapboxFeatureId?: string | number;
  /** Raw Mapbox feature properties (name, height, …) when available. */
  properties?: Record<string, unknown>;
}

const defaults: Building = {
  id: "",
  name: "",
  centroid: [0, 0],
};

export const buildingEntity: EntityType<Building> = {
  id: "campus.building",
  label: "Building",
  schema: identitySchema<Building>(),
  defaults,
  views: [],
  operations: [],
};
