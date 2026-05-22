import type { Map as MapboxMap } from "mapbox-gl";

/**
 * Wall-drawing snapping.
 *
 * Makes wall drawing precise without a separate CAD editor — the
 * difference between rough freehand polygons and a clean floor:
 *   - **endpoint** — latch onto a vertex already placed in this chain
 *     (so you can close a loop exactly);
 *   - **ortho** — lock the segment horizontal / vertical relative to
 *     the previous vertex when it is near an axis;
 *   - **free** — the raw click.
 *
 * Snapping is computed in projected screen space, so thresholds are
 * constant regardless of map zoom.
 */

export type WallSnapKind = "endpoint" | "ortho" | "free";

export interface WallSnap {
  point: [number, number];
  kind: WallSnapKind;
}

/** Endpoint snap radius, screen pixels. */
const ENDPOINT_PX = 14;
/** Ortho engages below this off-axis ratio (~10°). */
const ORTHO_RATIO = 0.18;

export function snapWallPoint(
  raw: [number, number],
  map: MapboxMap,
  pending: Array<[number, number]>,
): WallSnap {
  const rawPx = map.project(raw);

  // Endpoint — snap to a vertex already in this chain.
  let nearest: [number, number] | null = null;
  let nearestD = ENDPOINT_PX;
  for (const p of pending) {
    const px = map.project(p);
    const d = Math.hypot(px.x - rawPx.x, px.y - rawPx.y);
    if (d < nearestD) {
      nearestD = d;
      nearest = p;
    }
  }
  if (nearest) return { point: [nearest[0], nearest[1]], kind: "endpoint" };

  // Ortho — lock against the previous vertex.
  if (pending.length > 0) {
    const last = pending[pending.length - 1];
    const lastPx = map.project(last);
    const dx = rawPx.x - lastPx.x;
    const dy = rawPx.y - lastPx.y;
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    const ratio = horizontal
      ? Math.abs(dy) / (Math.abs(dx) || 1)
      : Math.abs(dx) / (Math.abs(dy) || 1);
    if (ratio < ORTHO_RATIO) {
      return {
        point: horizontal ? [raw[0], last[1]] : [last[0], raw[1]],
        kind: "ortho",
      };
    }
  }

  return { point: [raw[0], raw[1]], kind: "free" };
}
