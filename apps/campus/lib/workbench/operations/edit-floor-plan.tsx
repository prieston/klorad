"use client";

import { useState } from "react";
import type { FloorPlan } from "@klorad/api";
import { Button, Field, Input } from "@klorad/design-system";
import type {
  Operation,
  OperationFormProps,
} from "@klorad/config/workbench";
import { useCampusApiStore } from "../campus-api-store";

export interface EditFloorPlanArgs {
  name?: string;
  floor?: number;
  heightM?: number;
  visible: boolean;
}

function EditIcon({ className }: { className?: string }) {
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
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function EditFloorPlanForm({
  initialArgs,
  submit,
  cancel,
}: OperationFormProps<EditFloorPlanArgs>) {
  const seed: EditFloorPlanArgs = initialArgs ?? { visible: true };
  const [name, setName] = useState(seed.name ?? "");
  const [floor, setFloor] = useState(
    seed.floor != null ? String(seed.floor) : "",
  );
  const [height, setHeight] = useState(
    seed.heightM != null ? String(seed.heightM) : "",
  );
  const [visible, setVisible] = useState(seed.visible);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedFloor = floor.trim() ? Number(floor) : undefined;
    const parsedHeight = height.trim() ? Number(height) : undefined;
    submit({
      name: name.trim() || undefined,
      floor: Number.isFinite(parsedFloor) ? parsedFloor : undefined,
      heightM: Number.isFinite(parsedHeight) ? parsedHeight : undefined,
      visible,
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Name">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ground floor, 2nd floor, …"
          autoFocus
        />
      </Field>
      <Field label="Floor number">
        <Input
          value={floor}
          onChange={(e) => setFloor(e.target.value)}
          placeholder="0 = ground, 1 = first, -1 = basement"
          type="number"
        />
      </Field>
      <Field label="Floor height (metres)">
        <Input
          value={height}
          onChange={(e) => setHeight(e.target.value)}
          placeholder="3 (default)"
          type="number"
          min={0}
        />
      </Field>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-text-primary">
        <input
          type="checkbox"
          checked={visible}
          onChange={(e) => setVisible(e.target.checked)}
          className="h-4 w-4 rounded border-line-strong text-accent focus:ring-accent"
        />
        Visible
      </label>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={cancel}>
          Cancel
        </Button>
        <Button type="submit">Save</Button>
      </div>
    </form>
  );
}

/**
 * `floor-plan.edit-properties` — edit a floor plan's metadata.
 *
 * Phase 5d-e. The image upload + placement (corners) is a separate
 * heavier op (`floor-plan.replace-image`, deferred); this one covers
 * the lightweight metadata fields.
 */
export const editFloorPlanOp: Operation<EditFloorPlanArgs> = {
  id: "floor-plan.edit-properties",
  label: "Edit floor plan",
  icon: EditIcon,
  scope: ["campus.floor-plan"],
  Form: EditFloorPlanForm,
  applies: (sel, entities) => {
    if (!sel.focusedId) return false;
    return entities.byId(sel.focusedId)?.typeId === "campus.floor-plan";
  },
  initialArgs(ctx, on) {
    const id = on[0];
    if (!id) return undefined;
    const entity = ctx.entities.byId(id);
    if (!entity) return undefined;
    const plan = entity.payload as FloorPlan;
    return {
      name: plan.name,
      floor: plan.floor,
      heightM: plan.heightM,
      visible: plan.visible ?? true,
    };
  },
  async invoke(ctx, args, on) {
    const id = on[0];
    if (!id) return { ok: false, reason: "No floor plan id passed" };
    const api = useCampusApiStore.getState().api;
    if (!api) return { ok: false, reason: "Campus API not ready" };

    api.floorPlans.update(id, {
      name: args.name,
      floor: args.floor,
      heightM: args.heightM,
      visible: args.visible,
    });
    useCampusApiStore.getState().bump();

    ctx.toast(`Saved ${args.name ?? "floor plan"}`, "success");
    return { ok: true };
  },
};
