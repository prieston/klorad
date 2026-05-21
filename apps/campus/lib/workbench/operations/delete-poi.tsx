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
 * Delete a POI from the active world.
 *
 * Phase 5d-a — first write operation. Mirrors the
 * `apiRef.current.poi.remove(id)` call BuilderClient does today, but
 * routed through the typed `Operation` boundary so it's loggable,
 * replayable, and surfaceable in the command palette / right-click
 * menu / future AI suggestion stream.
 *
 * `applies` skips standalone-POI entries that are actually building
 * stand-ins (have a `linkedBuilding` payload). Those use the
 * `building.delete` op instead because deleting one cascades to
 * the floor plans + rooms attached to it.
 */
export const deletePoiOp: Operation = {
  id: "poi.delete",
  label: "Delete POI",
  icon: TrashIcon,
  scope: ["campus.poi"],
  applies: (sel, entities) => {
    if (!sel.focusedId) return false;
    const entity = entities.byId(sel.focusedId);
    if (!entity || entity.typeId !== "campus.poi") return false;
    // Buildings are POI-entities with a `linkedBuilding` payload — they
    // get the cascading building.delete instead.
    const payload = entity.payload as { linkedBuilding?: unknown };
    return !payload?.linkedBuilding;
  },
  async invoke(ctx, _args, on) {
    const id = on[0];
    if (!id) return { ok: false, reason: "No POI id passed" };
    const api = useCampusApiStore.getState().api;
    if (!api) return { ok: false, reason: "Campus API not ready" };

    const entity = ctx.entities.byId(id);
    const name =
      (entity?.payload as { name?: string } | undefined)?.name || "POI";

    api.poi.remove(id);
    useCampusApiStore.getState().bump();

    ctx.toast(`Deleted ${name}`, "success");
    return { ok: true };
  },
};
