/**
 * Placement intent — the bridge between an op that needs the user to
 * click on the map and the MapView that captures the clicks.
 *
 * Phase 5d-d / 5d-f. Ops call `begin(mode)` and receive a Promise
 * that resolves once the user finishes the interaction (or `null` on
 * cancel). The op `invoke` stays async-suspended in the meantime;
 * the shell's `runOperation` machinery doesn't need to know about
 * placement specifically.
 *
 * Two interaction kinds today:
 *
 *   - **Point** (`place-poi`) — one click. Resolves with
 *     `{ kind: "point", coords: [lng, lat] }`.
 *   - **Polygon** (`draw-building`) — repeated clicks accumulate
 *     vertices; double-click or `closePolygon()` closes the ring.
 *     Resolves with `{ kind: "polygon", points: [...] }`.
 *
 * Only one placement runs at a time. Starting a new one cancels the
 * old one with a `null` resolution.
 */
import { create } from "zustand";

export type PlacementMode = "place-poi" | "draw-building";

export type PlacementResult =
  | { kind: "point"; coords: [number, number] }
  | { kind: "polygon"; points: Array<[number, number]> };

/** Whether a mode collects a single click or a series of them. */
export function placementKind(mode: PlacementMode): "point" | "polygon" {
  return mode === "place-poi" ? "point" : "polygon";
}

interface PlacementStore {
  /** The active mode, or null when nothing is in progress. */
  active: PlacementMode | null;
  /**
   * Vertices accumulated so far in a polygon draw. Empty for point
   * modes and between draws. The MapView reads this to render the
   * live in-progress vertices (and the count in the banner).
   */
  pendingPoints: Array<[number, number]>;
  /** Begin a placement. Resolves with a typed result, or null on cancel. */
  begin(mode: PlacementMode): Promise<PlacementResult | null>;
  /** Capture a single point — terminates `place-poi`. */
  completePoint(coords: [number, number]): void;
  /** Add a vertex to a polygon-in-progress without closing it. */
  addPoint(coords: [number, number]): void;
  /** Close the polygon and resolve. Needs at least 3 vertices. */
  closePolygon(): void;
  /** Abort — resolves with null. */
  cancel(): void;
}

interface PlacementStoreInternal extends PlacementStore {
  resolver: ((result: PlacementResult | null) => void) | null;
}

export const usePlacementStore = create<PlacementStoreInternal>((set, get) => ({
  active: null,
  pendingPoints: [],
  resolver: null,
  begin(mode) {
    const prior = get().resolver;
    if (prior) prior(null);
    return new Promise((resolve) => {
      set({ active: mode, resolver: resolve, pendingPoints: [] });
    });
  },
  completePoint(coords) {
    const r = get().resolver;
    set({ active: null, resolver: null, pendingPoints: [] });
    r?.({ kind: "point", coords });
  },
  addPoint(coords) {
    set((s) => ({ pendingPoints: [...s.pendingPoints, coords] }));
  },
  closePolygon() {
    const { pendingPoints, resolver } = get();
    // Need at least 3 vertices for a real polygon. Otherwise cancel
    // — the user double-clicked too early and would get a degenerate
    // ring.
    if (pendingPoints.length < 3) {
      set({ active: null, resolver: null, pendingPoints: [] });
      resolver?.(null);
      return;
    }
    set({ active: null, resolver: null, pendingPoints: [] });
    resolver?.({ kind: "polygon", points: pendingPoints });
  },
  cancel() {
    const r = get().resolver;
    set({ active: null, resolver: null, pendingPoints: [] });
    r?.(null);
  },
}));
