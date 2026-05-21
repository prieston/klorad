/**
 * Tiny zustand store that holds the active `CampusAPI` instance plus
 * a monotonically-incrementing `version` counter. Ops mutate the API
 * and then call `bump()` to invalidate; the WorkbenchClient subscribes
 * to the version and re-syncs its React state on each tick.
 *
 * Why a store rather than threading the API through `OpInvokeContext`:
 *
 * 1. Mirrors the existing `useSceneStore` pattern campus already uses
 *    for the Mapbox instance (`useSceneStore.getState().mapboxMap`).
 *    Ops grab the API the same way.
 * 2. `OpInvokeContext` is vertical-agnostic — adding `campusApi` to it
 *    would couple the platform shell to one vertical's backend.
 * 3. Ops can call this from a `.invoke` outside the React tree.
 *
 * Phase 5d-a: introduced for the first wave of write operations
 * (`poi.delete`, `floor-plan.delete`). Subsequent sub-phases add more
 * ops that reach the API the same way.
 */
import type { CampusAPI } from "@klorad/api";
import { create } from "zustand";

interface CampusApiStore {
  /** The active API instance, or null before WorkbenchClient mounts. */
  api: CampusAPI | null;
  /**
   * Bumps whenever an op mutates the world. WorkbenchClient subscribes
   * and re-pulls entity lists when this changes. Reset to 0 when a
   * fresh API instance is registered.
   */
  version: number;
  /** Called by the consumer (WorkbenchClient) once per mount. */
  setApi(api: CampusAPI | null): void;
  /** Called by an op after a successful mutation. */
  bump(): void;
}

export const useCampusApiStore = create<CampusApiStore>((set) => ({
  api: null,
  version: 0,
  setApi: (api) => set({ api, version: 0 }),
  bump: () => set((s) => ({ version: s.version + 1 })),
}));
