import { create } from "zustand";

/**
 * Floor-plan design mode.
 *
 * While a `designPlanId` is set, the workbench hides every building
 * shell and flattens that floor's content to ground level — so the
 * user designs the plan flat (placing a reference image, drawing
 * walls), then exits and the floor lifts back to its real elevation.
 * Only the render height changes; the geometry (lng/lat) never moves.
 */
interface FloorDesignStore {
  /** The floor plan being designed, or null when not in design mode. */
  designPlanId: string | null;
  enter(planId: string): void;
  exit(): void;
}

export const useFloorDesignStore = create<FloorDesignStore>((set) => ({
  designPlanId: null,
  enter(planId) {
    set({ designPlanId: planId });
  },
  exit() {
    set({ designPlanId: null });
  },
}));
