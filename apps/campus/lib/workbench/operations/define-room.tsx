import type { FloorPlan } from "@klorad/api";
import type { Operation } from "@klorad/config/workbench";
import { useCampusApiStore } from "../campus-api-store";
import { usePlacementStore } from "../placement-store";

function RoomIcon({ className }: { className?: string }) {
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
      <rect x="4" y="4" width="16" height="16" rx="1" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="12" y1="4" x2="12" y2="20" />
    </svg>
  );
}

/** Close the ring — Room polygons follow the same GeoJSON convention as buildings. */
function closeRing(
  points: Array<[number, number]>,
): Array<[number, number]> {
  if (points.length === 0) return [];
  const [firstLng, firstLat] = points[0];
  const [lastLng, lastLat] = points[points.length - 1];
  if (firstLng === lastLng && firstLat === lastLat) return points;
  return [...points, [firstLng, firstLat]];
}

/**
 * Draw a room polygon inside the selected floor plan.
 *
 * Phase 5d-g. Reuses the same polygon-drawing infra `building.draw`
 * uses (`placement-store` in `draw-room` mode). The op only applies
 * when a floor plan is focused, so it picks up `buildingId` + `floor`
 * from that floor plan automatically — no second prompt for context.
 *
 * On polygon submit: creates a `Room` with the gathered polygon,
 * inherited building/floor, default `type: "other"` (editable
 * afterwards via `room.edit-properties`).
 */
export const defineRoomOp: Operation = {
  id: "room.define",
  label: "Define room",
  icon: RoomIcon,
  scope: ["campus.floor-plan"],
  applies: (sel, entities) => {
    if (!sel.focusedId) return false;
    const entity = entities.byId(sel.focusedId);
    if (!entity || entity.typeId !== "campus.floor-plan") return false;
    // Need a building + floor to anchor the room.
    const plan = entity.payload as FloorPlan;
    return Boolean(plan.buildingId) && plan.floor !== undefined;
  },
  async invoke(ctx, _args, on) {
    const planId = on[0];
    if (!planId) return { ok: false, reason: "No floor plan focused" };
    const planEntity = ctx.entities.byId(planId);
    if (!planEntity) return { ok: false, reason: "Floor plan not found" };
    const plan = planEntity.payload as FloorPlan;
    if (!plan.buildingId || plan.floor === undefined) {
      return { ok: false, reason: "Floor plan missing building or floor" };
    }

    const result = await usePlacementStore.getState().begin("draw-room");
    if (!result || result.kind !== "polygon") {
      return { ok: false, reason: "Cancelled" };
    }
    const api = useCampusApiStore.getState().api;
    if (!api) return { ok: false, reason: "Campus API not ready" };

    const polygon = closeRing(result.points);
    const created = api.rooms.add({
      name: "New room",
      type: "other",
      buildingId: plan.buildingId,
      floor: plan.floor,
      polygon,
    });
    useCampusApiStore.getState().bump();

    ctx.toast(`Defined ${created?.name ?? "room"}`, "success");
    return { ok: true };
  },
};
