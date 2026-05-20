import { defineWorkbench } from "@klorad/config/workbench";
import {
  poiEntity,
  buildingEntity,
  floorPlanEntity,
  tourStopEntity,
  eventEntity,
} from "@/lib/workbench";

/**
 * The campus vertical's Workbench configuration.
 *
 * Phase 1.2 — entities declared. Views, operations and the default
 * layout fill in as Phase 2–5 land (see `WORKBENCH.md` §10).
 *
 * Today nothing imports this file at runtime: the existing
 * `maps/[mapId]/builder/*` route keeps rendering off `Map.sceneData`.
 * The config exists so the shape compiles end-to-end, so the next
 * phase can mount the shell off `import workbenchConfig from
 * "@/workbench.config"` with no plumbing surprises.
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
  views: [],
  operations: [],
  defaultLayout: {
    left: [],
    center: [],
    right: [],
    bottom: [],
  },
});

export default workbenchConfig;
