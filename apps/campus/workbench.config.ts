import { defineWorkbench } from "@klorad/config/workbench";
import {
  poiEntity,
  buildingEntity,
  floorPlanEntity,
  roomEntity,
  tourStopEntity,
  eventEntity,
  navNodeEntity,
  navEdgeEntity,
  mapView,
  overviewView,
  tableView,
  hierarchyView,
  aiPanelView,
  workflowView,
  flyToPoiOp,
  openViewerOp,
  copyLinkOp,
  deletePoiOp,
  deleteFloorPlanOp,
  deleteBuildingOp,
  editPoiOp,
  editBuildingOp,
  editFloorPlanOp,
  saveWorldOp,
  captureThumbnailOp,
  publishWorldOp,
  placePoiOp,
  drawBuildingOp,
  deleteRoomOp,
  editRoomOp,
  defineRoomOp,
  uploadFloorPlanOp,
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
 * - Phase 4b  — `tableView` in the left region (POI list, click to
 *                select, bridges to the map)
 * - Phase 4c  — `hierarchyView` in the left region, stacked under
 *                the table (Building → Floor + child POIs tree)
 * - Phase 5a  — first typed `Operation` registered (`poi.fly-to`),
 *                invoked via `ctx.runOperation(...)` from a button in
 *                the OverviewView when a POI is focused
 * - Phase 5b  — `ctx.toast` wired through to react-toastify; two
 *                world-level ops added (`world.open-viewer`,
 *                `world.copy-link`)
 * - Phase 5c1 — operations surface generically from
 *                `ctx.applicableOperations`
 * - Phase 5c2 — command palette over the same registry (mod+k)
 * - Phase 5c3 — right-click context menu + generic world-actions
 * - Phase 5d-a — first wave of write ops: `poi.delete`,
 *                `floor-plan.delete`, `building.delete` (cascading)
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
    roomEntity,
    tourStopEntity,
    eventEntity,
    navNodeEntity,
    navEdgeEntity,
  ],
  views: [
    mapView,
    overviewView,
    workflowView,
    tableView,
    hierarchyView,
    aiPanelView,
  ],
  operations: [
    flyToPoiOp,
    openViewerOp,
    copyLinkOp,
    deletePoiOp,
    deleteFloorPlanOp,
    deleteBuildingOp,
    editPoiOp,
    editBuildingOp,
    editFloorPlanOp,
    saveWorldOp,
    captureThumbnailOp,
    publishWorldOp,
    placePoiOp,
    drawBuildingOp,
    deleteRoomOp,
    editRoomOp,
    defineRoomOp,
    uploadFloorPlanOp,
  ],
  defaultLayout: {
    // Left dock = a single guided Workflow view (Location / Buildings
    // / POIs). The standalone `table` + `hierarchy` views stay
    // registered for `mod+k` palette navigation but don't dock by
    // default — the workflow is the new user-facing surface.
    left: ["workflow"],
    center: ["map"],
    right: ["overview"],
    bottom: ["ai-panel"],
  },
});

export default workbenchConfig;
