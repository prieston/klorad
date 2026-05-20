import type { WorkbenchConfig } from "./types";

/**
 * Factory for a vertical's Workbench config. Consumers call this and export
 * the result; the shared shell imports it and assembles itself.
 *
 * For v1 this is a pass-through, but it's the single point of entry where
 * later checks can attach: unique-id validation across entities / views /
 * operations, operation-scope refs to existing types, default-layout refs
 * to existing views, etc.
 *
 * @example
 * ```ts
 * // apps/campus/workbench.config.ts
 * import { defineWorkbench } from "@klorad/config/workbench";
 * import { poiType, buildingType, floorPlanType } from "./entities";
 * import { mapView, tableView, hierarchyView } from "./views";
 * import { editProperties, deleteEntity, linkToBuilding } from "./operations";
 *
 * export default defineWorkbench({
 *   vertical: "campus",
 *   entities: [poiType, buildingType, floorPlanType],
 *   views: [mapView, tableView, hierarchyView],
 *   operations: [editProperties, deleteEntity, linkToBuilding],
 *   defaultLayout: {
 *     left: ["hierarchy"],
 *     center: ["map"],
 *     right: [],
 *     bottom: [],
 *   },
 * });
 * ```
 */
export function defineWorkbench(config: WorkbenchConfig): WorkbenchConfig {
  return config;
}
