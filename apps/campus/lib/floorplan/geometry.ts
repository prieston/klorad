import type { Pt, Wall } from "./types";

/** Euclidean distance between two points. */
export function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Snap step, metres — placed points land on this lattice. */
export const GRID_SNAP = 0.25;
/** Visual grid spacing, metres. */
export const GRID_VISUAL = 1;

/** Endpoint snap radius, screen pixels. */
const ENDPOINT_SNAP_PX = 12;
/** Ortho engages when the off-axis ratio is below this (~10°). */
const ORTHO_RATIO = 0.18;

/** What a snapped point latched onto — drives the cursor indicator. */
export type SnapKind = "endpoint" | "ortho" | "grid";

export interface SnapResult {
  pt: Pt;
  kind: SnapKind;
}

export interface SnapOptions {
  /** Existing walls — their endpoints are snap targets. */
  walls: Wall[];
  /** The in-progress wall's start, for the ortho constraint. */
  draftStart: Pt | null;
  /** Pixels-per-metre — the endpoint threshold is a screen distance. */
  scale: number;
  /** Force horizontal / vertical (Shift held). */
  forceOrtho: boolean;
}

function snapToGrid(p: Pt): Pt {
  return {
    x: Math.round(p.x / GRID_SNAP) * GRID_SNAP,
    y: Math.round(p.y / GRID_SNAP) * GRID_SNAP,
  };
}

/**
 * Resolve a raw world point to a snapped point. Precedence:
 *   1. endpoint — latch onto an existing wall end so walls connect;
 *   2. ortho    — lock horizontal / vertical relative to the draft
 *      start when the segment is near an axis (or Shift forces it);
 *   3. grid     — fall back to the snap lattice.
 */
export function snapPoint(raw: Pt, opts: SnapOptions): SnapResult {
  // 1. Endpoint snap.
  const threshold = ENDPOINT_SNAP_PX / opts.scale;
  let nearest: Pt | null = null;
  let nearestD = threshold;
  for (const w of opts.walls) {
    for (const e of [w.start, w.end]) {
      const d = dist(raw, e);
      if (d < nearestD) {
        nearestD = d;
        nearest = e;
      }
    }
  }
  if (nearest) return { pt: { ...nearest }, kind: "endpoint" };

  // 2. Ortho constraint, relative to the draft start.
  if (opts.draftStart) {
    const dx = raw.x - opts.draftStart.x;
    const dy = raw.y - opts.draftStart.y;
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    const ratio = horizontal
      ? Math.abs(dy) / (Math.abs(dx) || 1)
      : Math.abs(dx) / (Math.abs(dy) || 1);
    if (opts.forceOrtho || ratio < ORTHO_RATIO) {
      const locked: Pt = horizontal
        ? { x: raw.x, y: opts.draftStart.y }
        : { x: opts.draftStart.x, y: raw.y };
      return { pt: snapToGrid(locked), kind: "ortho" };
    }
  }

  // 3. Grid snap.
  return { pt: snapToGrid(raw), kind: "grid" };
}
