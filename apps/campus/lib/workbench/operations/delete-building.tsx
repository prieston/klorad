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
 * Cascading delete: removes a building's rooms, its floor plans, and
 * the building POI itself.
 *
 * Phase 5d-a. Mirrors the BuilderClient's cascade — the building POI
 * is just a POI with a `linkedBuilding` payload, and its floor plans
 * + rooms are owned by it. Deleting any in isolation would orphan
 * the others.
 *
 * `applies` requires the focused entity to be a POI with a
 * `linkedBuilding` payload. The plain `poi.delete` op filters those
 * out so the two never collide.
 */
export const deleteBuildingOp: Operation = {
  id: "building.delete",
  label: "Delete building",
  icon: TrashIcon,
  scope: ["campus.poi"],
  applies: (sel, entities) => {
    if (!sel.focusedId) return false;
    const entity = entities.byId(sel.focusedId);
    if (!entity || entity.typeId !== "campus.poi") return false;
    const payload = entity.payload as { linkedBuilding?: unknown };
    return Boolean(payload?.linkedBuilding);
  },
  async invoke(ctx, _args, on) {
    const id = on[0];
    if (!id) return { ok: false, reason: "No building id passed" };
    const api = useCampusApiStore.getState().api;
    if (!api) return { ok: false, reason: "Campus API not ready" };

    const entity = ctx.entities.byId(id);
    const name =
      (entity?.payload as { name?: string } | undefined)?.name || "Building";

    // Cascade — rooms first, then plans, then the building POI itself.
    // Same order BuilderClient uses; reversing it would orphan referents.
    for (const r of api.rooms.forBuilding(id)) api.rooms.remove(r.id);
    for (const p of api.floorPlans.forBuilding(id)) api.floorPlans.remove(p.id);
    api.poi.remove(id);

    useCampusApiStore.getState().bump();
    ctx.toast(`Deleted ${name} and its contents`, "success");
    return { ok: true };
  },
};
