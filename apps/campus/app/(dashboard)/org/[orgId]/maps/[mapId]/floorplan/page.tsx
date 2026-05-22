import { FloorPlanEditor } from "@/lib/floorplan/FloorPlanEditor";

/**
 * `/org/[orgId]/maps/[mapId]/floorplan` — the indoor floor-plan
 * editor. Phase 1: a standalone route for the wall-drawing editor;
 * later phases load/save a campus's plan and wire it into the
 * workbench.
 */
export default function FloorPlanPage() {
  return (
    <div className="h-[calc(100vh-3.5rem)] w-full">
      <FloorPlanEditor />
    </div>
  );
}
