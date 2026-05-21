import type { Operation } from "@klorad/config/workbench";
import { useCampusApiStore } from "../campus-api-store";

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6 17.5 19a2 2 0 0 1-2 1.8h-7a2 2 0 0 1-2-1.8L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

/**
 * Delete a floor plan from the active world.
 *
 * Phase 5d-a. Calls `api.floorPlans.remove(id)` and bumps the campus
 * API store so WorkbenchClient re-pulls. Rooms attached to the floor
 * plan stay (they live on the building); only the plan image and its
 * placement metadata are dropped.
 */
export const deleteFloorPlanOp: Operation = {
  id: "floor-plan.delete",
  label: "Delete floor plan",
  icon: TrashIcon,
  scope: ["campus.floor-plan"],
  applies: (sel, entities) => {
    if (!sel.focusedId) return false;
    const entity = entities.byId(sel.focusedId);
    return entity?.typeId === "campus.floor-plan";
  },
  async invoke(ctx, _args, on) {
    const id = on[0];
    if (!id) return { ok: false, reason: "No floor plan id passed" };
    const api = useCampusApiStore.getState().api;
    if (!api) return { ok: false, reason: "Campus API not ready" };

    const entity = ctx.entities.byId(id);
    const name =
      (entity?.payload as { name?: string } | undefined)?.name || "Floor plan";

    api.floorPlans.remove(id);
    useCampusApiStore.getState().bump();

    ctx.toast(`Deleted ${name}`, "success");
    return { ok: true };
  },
};
