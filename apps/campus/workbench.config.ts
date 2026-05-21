import { defineWorkbench } from "@klorad/config/workbench";
import {
  poiEntity,
  buildingEntity,
  floorPlanEntity,
  tourStopEntity,
  eventEntity,
  mapView,
  overviewView,
} from "@/lib/workbench";

/**
 * The campus vertical's Workbench configuration.
 *
 * - Phase 1.2 — five typed entities registered
 * - Phase 2   — `mapView` placeholder in the centre region
 * - Phase 3b  — real 3D `mapView` (POIs + drawn buildings + selection
 *                bridge)
 * - Phase 4a  — `overviewView` in the right region (POI / building /
 *                floor-plan counts, accessibility coverage)
 * - Phase 4b+ — TableView (left), HierarchyView (left), operations,
 *                further layout tuning
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
  views: [mapView, overviewView],
  operations: [],
  defaultLayout: {
    left: [],
    center: ["map"],
    right: ["overview"],
    bottom: [],
  },
});

export default workbenchConfig;
