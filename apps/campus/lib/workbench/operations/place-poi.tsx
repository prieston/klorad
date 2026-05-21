import type { Operation } from "@klorad/config/workbench";
import { useCampusApiStore } from "../campus-api-store";
import { usePlacementStore } from "../placement-store";

function PlusIcon({ className }: { className?: string }) {
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
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

/**
 * Place a new POI by clicking on the map.
 *
 * Phase 5d-d — first modal-interaction op. The flow:
 *
 *   1. `invoke` calls `placement.begin("place-poi")`, which returns a
 *      Promise.
 *   2. The shell stays alive. The MapView reads the placement store,
 *      sees the active mode, and registers a one-shot click listener
 *      on the Mapbox map.
 *   3. When the user clicks, the MapView calls `placement.complete([lng, lat])`,
 *      which resolves the promise here.
 *   4. We add the POI via `api.poi.add(...)` and bump the campus API
 *      store so views re-render.
 *
 * Esc (handled in the MapView) cancels the placement; the promise
 * resolves with `null` and `invoke` reports `{ ok: false }`.
 *
 * World-level (no entity scope). Surfaces in the command palette,
 * right-click on empty map (when that lands), and OverviewView's
 * WorldActions panel.
 */
export const placePoiOp: Operation = {
  id: "poi.place",
  label: "Place POI",
  icon: PlusIcon,
  scope: [],
  applies: () => true,
  async invoke(ctx) {
    const result = await usePlacementStore.getState().begin("place-poi");
    if (!result || result.kind !== "point") {
      // Esc / cancelled / superseded by a new placement. Quiet exit
      // — no toast, since the user clearly chose to back out.
      return { ok: false, reason: "Cancelled" };
    }
    const api = useCampusApiStore.getState().api;
    if (!api) {
      ctx.toast("Campus API not ready", "error");
      return { ok: false, reason: "Campus API not ready" };
    }

    const [lng, lat] = result.coords;
    const created = api.poi.add({
      name: "New POI",
      position: [lng, lat, 0],
    });
    useCampusApiStore.getState().bump();
    ctx.toast(`Placed ${created?.name ?? "POI"}`, "success");
    return { ok: true };
  },
};
