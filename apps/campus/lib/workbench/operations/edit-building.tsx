"use client";

import { useState } from "react";
import type { POI } from "@klorad/api";
import { Button, Field, Input, Textarea } from "@klorad/design-system";
import type {
  Operation,
  OperationFormProps,
} from "@klorad/config/workbench";
import { useCampusApiStore } from "../campus-api-store";

export interface EditBuildingArgs {
  name: string;
  description?: string;
  heightM?: number;
  wheelchairAccessible: boolean;
  accessibilityNotes?: string;
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

/**
 * Building properties form. Buildings are POIs with a `linkedBuilding`
 * payload; we surface name + description (POI-level) plus `heightM`
 * (linkedBuilding) and the accessibility block.
 */
function EditBuildingForm({
  initialArgs,
  submit,
  cancel,
}: OperationFormProps<EditBuildingArgs>) {
  const seed: EditBuildingArgs = initialArgs ?? {
    name: "",
    wheelchairAccessible: false,
  };
  const [name, setName] = useState(seed.name);
  const [description, setDescription] = useState(seed.description ?? "");
  const [height, setHeight] = useState(
    seed.heightM != null ? String(seed.heightM) : "",
  );
  const [wheelchair, setWheelchair] = useState(seed.wheelchairAccessible);
  const [accessNotes, setAccessNotes] = useState(
    seed.accessibilityNotes ?? "",
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedHeight = height.trim() ? Number(height) : undefined;
    submit({
      name: name.trim() || "Unnamed building",
      description: description.trim() || undefined,
      heightM: Number.isFinite(parsedHeight) ? parsedHeight : undefined,
      wheelchairAccessible: wheelchair,
      accessibilityNotes: accessNotes.trim() || undefined,
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Name">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Engineering Building, Library, …"
        />
      </Field>
      <Field label="Description">
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What lives here? Departments, services…"
          rows={3}
        />
      </Field>
      <Field label="Height (metres)">
        <Input
          value={height}
          onChange={(e) => setHeight(e.target.value)}
          placeholder="e.g. 12"
          type="number"
          min={0}
        />
      </Field>
      <div className="space-y-2 rounded-xl border border-line-soft bg-surface-1 p-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-text-primary">
          <input
            type="checkbox"
            checked={wheelchair}
            onChange={(e) => setWheelchair(e.target.checked)}
            className="h-4 w-4 rounded border-line-strong text-accent focus:ring-accent"
          />
          Wheelchair accessible
        </label>
        {wheelchair ? (
          <Field label="Accessibility notes">
            <Textarea
              value={accessNotes}
              onChange={(e) => setAccessNotes(e.target.value)}
              placeholder="Step-free entrance via the north side, elevator to floor 3, …"
              rows={2}
            />
          </Field>
        ) : null}
      </div>
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
 * `building.edit-properties` — edit a building's headline metadata.
 *
 * Phase 5d-e. Building entries are POIs with a `linkedBuilding`
 * payload; the form edits POI-level `name` / `description` /
 * `accessibility` and the linkedBuilding's `heightM`.
 */
export const editBuildingOp: Operation<EditBuildingArgs> = {
  id: "building.edit-properties",
  label: "Edit building",
  icon: EditIcon,
  scope: ["campus.poi"],
  Form: EditBuildingForm,
  applies: (sel, entities) => {
    if (!sel.focusedId) return false;
    const entity = entities.byId(sel.focusedId);
    if (!entity || entity.typeId !== "campus.poi") return false;
    const payload = entity.payload as { linkedBuilding?: unknown };
    return Boolean(payload.linkedBuilding);
  },
  initialArgs(ctx, on) {
    const id = on[0];
    if (!id) return undefined;
    const entity = ctx.entities.byId(id);
    if (!entity) return undefined;
    const poi = entity.payload as POI;
    return {
      name: poi.name ?? "",
      description: poi.description,
      heightM: poi.linkedBuilding?.heightM,
      wheelchairAccessible: poi.accessibility?.wheelchairAccessible ?? false,
      accessibilityNotes: poi.accessibility?.notes,
    };
  },
  async invoke(ctx, args, on) {
    const id = on[0];
    if (!id) return { ok: false, reason: "No building id passed" };
    const api = useCampusApiStore.getState().api;
    if (!api) return { ok: false, reason: "Campus API not ready" };

    const entity = ctx.entities.byId(id);
    const poi = entity?.payload as POI | undefined;
    const hasAccess = args.wheelchairAccessible || !!args.accessibilityNotes;

    api.poi.update(id, {
      name: args.name,
      description: args.description,
      accessibility: hasAccess
        ? {
            wheelchairAccessible: args.wheelchairAccessible,
            notes: args.accessibilityNotes,
          }
        : undefined,
      linkedBuilding: poi?.linkedBuilding
        ? {
            ...poi.linkedBuilding,
            heightM: args.heightM,
          }
        : undefined,
    });
    useCampusApiStore.getState().bump();

    ctx.toast(`Saved ${args.name}`, "success");
    return { ok: true };
  },
};
