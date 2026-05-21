/**
 * Placement intent — the bridge between an op that needs the user to
 * click a point on the map and the MapView that captures the click.
 *
 * Phase 5d-d. Ops like `poi.place` call `begin("place-poi")` and
 * receive a Promise that resolves once the MapView calls
 * `complete([lng, lat])` (or `cancel()` if the user backs out with
 * Esc). The op `invoke` stays async-suspended in the meantime; the
 * shell's Form / runOperation machinery doesn't need to know about
 * placement specifically.
 *
 * Only one placement runs at a time. Starting a new one cancels the
 * old one with a `null` resolution.
 */
import { create } from "zustand";

export type PlacementMode = "place-poi";

interface PlacementStore {
  /** The active placement mode, or null when nothing is in progress. */
  active: PlacementMode | null;
  /** Begin a placement. Resolves with coords on `complete`, or null on `cancel`. */
  begin(mode: PlacementMode): Promise<[number, number] | null>;
  /** Called by the MapView once the user clicks. */
  complete(coords: [number, number]): void;
  /** Called by the MapView (or globally on Esc) to abort. */
  cancel(): void;
}

interface PlacementStoreInternal extends PlacementStore {
  resolver: ((coords: [number, number] | null) => void) | null;
}

export const usePlacementStore = create<PlacementStoreInternal>((set, get) => ({
  active: null,
  resolver: null,
  begin(mode) {
    // If a prior placement is in flight, cancel it first so its caller
    // resolves with null instead of hanging forever.
    const prior = get().resolver;
    if (prior) prior(null);
    return new Promise((resolve) => {
      set({ active: mode, resolver: resolve });
    });
  },
  complete(coords) {
    const r = get().resolver;
    set({ active: null, resolver: null });
    r?.(coords);
  },
  cancel() {
    const r = get().resolver;
    set({ active: null, resolver: null });
    r?.(null);
  },
}));
