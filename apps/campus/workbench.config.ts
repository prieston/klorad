import { defineWorkbench } from "@klorad/config/workbench";
import {
  poiEntity,
  buildingEntity,
  floorPlanEntity,
  tourStopEntity,
  eventEntity,
  mapView,
} from "@/lib/workbench";

/**
 * The campus vertical's Workbench configuration.
 *
 * - Phase 1.2 — five typed entities registered
 * - Phase 2   — one placeholder `mapView` in the centre region
 * - Phase 3+  — real views (Map / Table / Hierarchy / Overview),
 *                operations, populated dock layout
 *
 * Imported by `/maps/[mapId]/workbench/page.tsx` at runtime; the old
 * `/maps/[mapId]/builder` route stays untouched until Phase 6.
 *
 * See `apps/campus/WORKBENCH.md` §10 for the full migration plan.
 */
const workbenchConfig = defineWorkbench({
  vertical: "campus",
  entities: [
    poiEntity,
    buildingEntity,
    floorPlanEntity,
    tourStopEntity,
    eventEntity,
  ],
  views: [mapView],
  operations: [],
  defaultLayout: {
    left: [],
    center: ["map"],
    right: [],
    bottom: [],
  },
});

export default workbenchConfig;
