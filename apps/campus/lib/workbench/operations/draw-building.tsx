import type { Operation } from "@klorad/config/workbench";
import { useCampusApiStore } from "../campus-api-store";
import { usePlacementStore } from "../placement-store";

function BuildingIcon({ className }: { className?: string }) {
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
      <rect x="3" y="3" width="18" height="18" rx="1" />
      <line x1="8" y1="3" x2="8" y2="21" />
      <line x1="16" y1="3" x2="16" y2="21" />
    </svg>
  );
}

/** Average the vertices for a quick centroid. Good-enough for a POI position. */
function centroidOf(points: Array<[number, number]>): [number, number] {
  let lngSum = 0;
  let latSum = 0;
  for (const [lng, lat] of points) {
    lngSum += lng;
    latSum += lat;
  }
  const n = points.length || 1;
  return [lngSum / n, latSum / n];
}

/** Close the ring — Mapbox/GeoJSON polygons require the last point to equal the first. */
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
 * Draw a building polygon on the map.
 *
 * Phase 5d-f. First polygon-drawing op. The flow:
 *
 *   1. `invoke` calls `placement.begin("draw-building")`.
 *   2. MapView intercepts each click on the map; each one adds a
 *      vertex to the placement store's `pendingPoints`.
 *   3. The user closes the ring by double-clicking, hitting Enter,
 *      or pressing "Done" on the placement banner.
 *   4. The store resolves the promise with `{ kind: "polygon", points }`.
 *   5. We create a POI with a `linkedBuilding.polygon` that the
 *      drawn-buildings layer renders as a fill-extrusion.
 *
 * Buildings need at least 3 vertices; the store's `closePolygon`
 * cancels with `null` if the user double-clicks too early. Default
 * extrusion height: 12m (≈ 4 floors). Editable via
 * `building.edit-properties` afterwards.
 */
export const drawBuildingOp: Operation = {
  id: "building.draw",
  label: "Draw building",
  icon: BuildingIcon,
  scope: [],
  applies: () => true,
  async invoke(ctx) {
    const result = await usePlacementStore.getState().begin("draw-building");
    if (!result || result.kind !== "polygon") {
      return { ok: false, reason: "Cancelled" };
    }
    const api = useCampusApiStore.getState().api;
    if (!api) {
      ctx.toast("Campus API not ready", "error");
      return { ok: false, reason: "Campus API not ready" };
    }

    const polygon = closeRing(result.points);
    const [lng, lat] = centroidOf(result.points);

    const created = api.poi.add({
      name: "New building",
      position: [lng, lat, 0],
      linkedBuilding: {
        lng,
        lat,
        polygon,
        heightM: 12,
      },
    });
    useCampusApiStore.getState().bump();
    ctx.toast(`Drew ${created?.name ?? "building"}`, "success");
    return { ok: true };
  },
};
