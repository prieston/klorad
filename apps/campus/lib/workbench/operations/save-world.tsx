import type { Operation } from "@klorad/config/workbench";
import { useCampusApiStore } from "../campus-api-store";

function SaveIcon({ className }: { className?: string }) {
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
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}

/**
 * Persist the current scene to the backend.
 *
 * Phase 5d-c. Mirrors `BuilderClient`'s `handleSave` — exports the
 * scene from the CampusAPI and PATCHes `/api/maps/{worldId}` with
 * the resulting payload.
 *
 * World-level (no entity scope). Surfaces in the command palette
 * and via OverviewView's `WorldActions` panel.
 */
export const saveWorldOp: Operation = {
  id: "world.save",
  label: "Save",
  icon: SaveIcon,
  scope: [],
  applies: () => true,
  async invoke(ctx) {
    const api = useCampusApiStore.getState().api;
    if (!api) return { ok: false, reason: "Campus API not ready" };

    try {
      const sceneData = api.export();
      const res = await fetch(`/api/maps/${ctx.worldId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneData }),
      });
      if (!res.ok) {
        ctx.toast("Failed to save the map", "error");
        return { ok: false, reason: `Save failed: ${res.status}` };
      }
      ctx.toast("Map saved", "success");
      return { ok: true };
    } catch (err) {
      ctx.toast("Failed to save the map", "error");
      return {
        ok: false,
        reason: err instanceof Error ? err.message : "Save failed",
      };
    }
  },
};
