import type { POI } from "@klorad/api";
import type { Operation } from "@klorad/config/workbench";
import { useSceneStore } from "@klorad/core";
import type { Map as MapboxMap } from "mapbox-gl";

/**
 * Fly the Mapbox camera to a POI.
 *
 * Phase 5a — the first operation. Demonstrates the contract
 * end-to-end:
 *
 *   - declared in @klorad/config/workbench's `Operation` shape
 *   - registered on the campus workbench config
 *   - invoked from a view via `ctx.runOperation("poi.fly-to", …)`
 *
 * Reads the focused POI's `position` off the entity index and calls
 * Mapbox's `flyTo`. The Mapbox instance comes off the global scene
 * store (the same store both `/builder` and the Workbench MapView
 * write into) — operations don't need a custom engine handle for
 * v1; they reach the engine via the existing shared singleton.
 */
export const flyToPoiOp: Operation = {
  id: "poi.fly-to",
  label: "Fly to POI",
  scope: ["campus.poi"],
  applies: (sel, entities) => {
    if (!sel.focusedId) return false;
    const entity = entities.byId(sel.focusedId);
    return entity?.typeId === "campus.poi";
  },
  async invoke(ctx, _args, on) {
    const id = on[0] ?? ctx.entities.all().find((e) => e.typeId === "campus.poi")?.id;
    if (!id) return { ok: false, reason: "No POI to fly to" };

    const entity = ctx.entities.byId(id);
    if (!entity || entity.typeId !== "campus.poi") {
      return { ok: false, reason: `Not a POI: ${id}` };
    }

    const poi = entity.payload as POI;
    const [lng, lat] = poi.position;
    const map = useSceneStore.getState().mapboxMap as MapboxMap | null;
    if (!map) return { ok: false, reason: "Map not loaded" };

    map.flyTo({
      center: [lng, lat],
      zoom: poi.view?.zoom ?? 17,
      pitch: poi.view?.pitch,
      bearing: poi.view?.bearing,
      duration: 1500,
      essential: true,
    });

    ctx.toast(`Flying to ${poi.name || "POI"}`);
    return { ok: true };
  },
};
