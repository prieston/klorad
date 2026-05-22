import type { POI } from "@klorad/api";
import type { Operation } from "@klorad/config/workbench";
import { useCampusApiStore } from "../campus-api-store";

function FloorPlusIcon({ className }: { className?: string }) {
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
      <path d="M3 7l9-4 9 4-9 4-9-4Z" />
      <path d="M3 13l5 2.2" />
      <path d="M16 16h6M19 13v6" />
    </svg>
  );
}

/** "Ground floor" / "Floor 2" / "Basement 1" — a friendly default name. */
function floorName(level: number): string {
  if (level === 0) return "Ground floor";
  if (level > 0) return `Floor ${level}`;
  return `Basement ${-level}`;
}

/**
 * Resolve the focused entity to the building the new floor belongs
 * to. A building POI resolves to itself; a floor plan resolves to its
 * parent building.
 */
function buildingIdFor(focusedId: string, pois: POI[]): string | null {
  const poi = pois.find((p) => p.id === focusedId);
  if (poi?.linkedBuilding) return poi.id;
  const api = useCampusApiStore.getState().api;
  const plan = api?.floorPlans.getAll().find((p) => p.id === focusedId);
  return plan?.buildingId ?? null;
}

/**
 * `floor.add` — add an empty floor to a building.
 *
 * Floors are `FloorPlan` entities; a plan with no image URL is a
 * valid "floor placeholder" — rooms can be drawn on it right away
 * and an image uploaded later via `floor-plan.upload`. This op is the
 * quick path: one click adds the next level up, no form, no image.
 *
 * Scoped to buildings and floor plans so it surfaces in the
 * inspector whether the user has a building or one of its floors
 * selected.
 */
export const addFloorOp: Operation = {
  id: "floor.add",
  label: "Add floor",
  icon: FloorPlusIcon,
  scope: ["campus.poi", "campus.floor-plan"],
  applies: (sel, entities) => {
    if (!sel.focusedId) return false;
    const entity = entities.byId(sel.focusedId);
    if (!entity) return false;
    if (entity.typeId === "campus.floor-plan") return true;
    if (entity.typeId === "campus.poi") {
      const payload = entity.payload as { linkedBuilding?: unknown };
      return Boolean(payload.linkedBuilding);
    }
    return false;
  },
  async invoke(ctx, _args, on) {
    const focusedId = on[0];
    if (!focusedId) return { ok: false, reason: "Nothing selected" };

    const api = useCampusApiStore.getState().api;
    if (!api) return { ok: false, reason: "Campus API not ready" };

    const buildingId = buildingIdFor(focusedId, api.poi.getAll());
    if (!buildingId) {
      ctx.toast("Select a building or one of its floors first", "warning");
      return { ok: false, reason: "No building in focus" };
    }

    // Next level = one above the highest existing floor; the first
    // floor of an empty building is the ground floor (0).
    const existing = api.floorPlans.forBuilding(buildingId);
    const nextLevel =
      existing.length === 0
        ? 0
        : Math.max(...existing.map((p) => p.floor ?? 0)) + 1;

    const created = api.floorPlans.add({
      name: floorName(nextLevel),
      buildingId,
      floor: nextLevel,
      visible: true,
    });
    useCampusApiStore.getState().bump();

    ctx.toast(`Added ${created?.name ?? floorName(nextLevel)}`, "success");
    return { ok: true };
  },
};
