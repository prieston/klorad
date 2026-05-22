import type { FloorPlan, Wall } from "@klorad/api";
import type { Operation } from "@klorad/config/workbench";
import { useCampusApiStore } from "../campus-api-store";
import { usePlacementStore } from "../placement-store";

function WallIcon({ className }: { className?: string }) {
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
      <path d="M3 20 L9 4 L15 20 L21 8" />
    </svg>
  );
}

/**
 * Draw a wall on the selected floor plan.
 *
 * Reuses the placement infrastructure buildings and rooms use — but
 * in `draw-wall` mode, which resolves an *open* polyline rather than
 * a closed ring. The MapView snaps each click (endpoint / ortho) so
 * the wall chain comes out connected and straight.
 *
 * Walls are stored on the floor plan (`FloorPlan.walls`); the op
 * appends the new wall to whatever the plan already has.
 */
export const drawWallOp: Operation = {
  id: "wall.draw",
  label: "Draw wall",
  icon: WallIcon,
  scope: ["campus.floor-plan"],
  applies: (sel, entities) => {
    if (!sel.focusedId) return false;
    const entity = entities.byId(sel.focusedId);
    return Boolean(entity && entity.typeId === "campus.floor-plan");
  },
  async invoke(ctx, _args, on) {
    const planId = on[0];
    if (!planId) return { ok: false, reason: "No floor plan focused" };

    const result = await usePlacementStore.getState().begin("draw-wall");
    if (!result || result.kind !== "line") {
      return { ok: false, reason: "Cancelled" };
    }
    const api = useCampusApiStore.getState().api;
    if (!api) return { ok: false, reason: "Campus API not ready" };

    const plan = api.floorPlans.getAll().find((p: FloorPlan) => p.id === planId);
    if (!plan) return { ok: false, reason: "Floor plan not found" };

    const wall: Wall = {
      id: crypto.randomUUID(),
      points: result.points,
      thickness: 0.15,
    };
    api.floorPlans.update(planId, {
      walls: [...(plan.walls ?? []), wall],
    });
    useCampusApiStore.getState().bump();

    ctx.toast("Wall drawn", "success");
    return { ok: true };
  },
};
