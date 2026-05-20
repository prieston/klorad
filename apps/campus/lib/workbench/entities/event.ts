import type { POIEvent } from "@klorad/api";
import type { EntityType } from "@klorad/config/workbench";
import { identitySchema } from "../schema";

const defaults: POIEvent = {
  id: "",
  title: "",
  startsAt: "",
  endsAt: "",
};

/**
 * Event — a scheduled occurrence at a POI (lecture, workshop, tour,
 * exhibition). Today stored as a nested array on POI; the Workbench
 * promotes it to a first-class entity so events can be authored,
 * filtered, and shown on a Timeline view independently of POIs.
 *
 * The runtime payload mirrors `@klorad/api`'s `POIEvent` interface.
 */
export const eventEntity: EntityType<POIEvent> = {
  id: "campus.event",
  label: "Event",
  schema: identitySchema<POIEvent>(),
  defaults,
  views: [],
  operations: [],
};
