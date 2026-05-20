import type { FloorPlan } from "@klorad/api";
import type { EntityType } from "@klorad/config/workbench";
import { identitySchema } from "../schema";

const defaults: FloorPlan = {
  id: "",
};

/**
 * Floor plan — an image (or placeholder) tied to a building floor.
 * Rooms can be drawn on top of it. The runtime shape today is
 * `@klorad/api`'s `FloorPlan` interface; the Workbench reads it via
 * this typed registration.
 */
export const floorPlanEntity: EntityType<FloorPlan> = {
  id: "campus.floor-plan",
  label: "Floor plan",
  schema: identitySchema<FloorPlan>(),
  defaults,
  views: [],
  operations: [],
};
