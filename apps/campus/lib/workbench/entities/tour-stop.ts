import type { TourStop } from "@klorad/api";
import type { EntityType } from "@klorad/config/workbench";
import { identitySchema } from "../schema";

const defaults: TourStop = {
  id: 0,
  title: "",
  description: "",
  cameraPosition: null,
  cameraTarget: null,
};

/**
 * Tour stop — a guided camera waypoint with a title, description, and
 * camera framing. Multiple stops form a tour the public viewer can play
 * back. The runtime shape today is `@klorad/api`'s `TourStop`; the
 * Workbench reads it via this typed registration.
 */
export const tourStopEntity: EntityType<TourStop> = {
  id: "campus.tour-stop",
  label: "Tour stop",
  schema: identitySchema<TourStop>(),
  defaults,
  views: [],
  operations: [],
};
