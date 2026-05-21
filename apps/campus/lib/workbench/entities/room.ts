import type { Room } from "@klorad/api";
import type { EntityType } from "@klorad/config/workbench";
import { identitySchema } from "../schema";

/**
 * A room as a first-class campus entity.
 *
 * The actual shape comes from `@klorad/api`'s `Room` type — a closed
 * polygon ring + building + floor + display metadata. Promoting it
 * here lets ops like `room.define`, `room.edit-properties`, and
 * `room.delete` carry a real `scope` and surface generically in the
 * Workbench's selection panel / command palette / right-click menu.
 */
const defaults: Room = {
  id: "",
  name: "",
  type: "other",
  buildingId: "",
  floor: 0,
  polygon: [],
};

export const roomEntity: EntityType<Room> = {
  id: "campus.room",
  label: "Room",
  schema: identitySchema<Room>(),
  defaults,
  views: [],
  operations: [],
};
