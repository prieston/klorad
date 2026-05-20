import type { POI } from "@klorad/api";
import type { EntityType } from "@klorad/config/workbench";
import { identitySchema } from "../schema";

/** Sensible empty defaults for a fresh POI. */
const defaults: POI = {
  id: "",
  name: "",
  objectId: "",
  position: [0, 0, 0],
};

/**
 * Point of interest — the meaningful unit of a campus map. A POI carries
 * a position, an optional category, optional media, accessibility info,
 * and an optional link to a Building.
 *
 * The runtime shape today is `@klorad/api`'s `POI` interface; the
 * Workbench reads the same shape via this typed registration.
 */
export const poiEntity: EntityType<POI> = {
  id: "campus.poi",
  label: "POI",
  schema: identitySchema<POI>(),
  defaults,
  // Filled in as the Workbench shell + views and operations come online
  // in Phase 2 and Phase 4–5.
  views: [],
  operations: [],
};
