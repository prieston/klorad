"use client";

import { useState } from "react";
import type { POI, POICategory } from "@klorad/api";
import { Button, Field, Input, Select, Textarea } from "@klorad/design-system";
import type {
  Operation,
  OperationFormProps,
} from "@klorad/config/workbench";
import { useCampusApiStore } from "../campus-api-store";

/** Form-collected arguments for `poi.edit-properties`. */
export interface EditPoiArgs {
  name: string;
  category?: POICategory;
  description?: string;
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

const CATEGORY_OPTIONS: { value: POICategory; label: string }[] = [
  { value: "building", label: "Building" },
  { value: "department", label: "Department" },
  { value: "library", label: "Library" },
  { value: "dining", label: "Dining" },
  { value: "parking", label: "Parking" },
  { value: "sports", label: "Sports" },
  { value: "medical", label: "Medical" },
  { value: "admin", label: "Admin" },
  { value: "housing", label: "Housing" },
  { value: "amenity", label: "Amenity" },
  { value: "custom", label: "Custom" },
];

/**
 * Inline form for editing a POI's headline properties. Renders inside
 * the shell's Form modal — the shell passes `initialArgs` from the
 * op's `initialArgs` resolver (the current POI's values), tracks
 * submit / cancel, and routes the gathered args back to `invoke`.
 *
 * Scope is intentionally narrow for v1: name, category, description,
 * accessibility. Media / events / hours / floor get their own ops
 * once they need more than a flat form to edit.
 */
function EditPoiForm({
  initialArgs,
  submit,
  cancel,
}: OperationFormProps<EditPoiArgs>) {
  const seed: EditPoiArgs = initialArgs ?? {
    name: "",
    wheelchairAccessible: false,
  };
  const [name, setName] = useState(seed.name);
  const [category, setCategory] = useState<POICategory | undefined>(
    seed.category,
  );
  const [description, setDescription] = useState(seed.description ?? "");
  const [wheelchair, setWheelchair] = useState(seed.wheelchairAccessible);
  const [accessNotes, setAccessNotes] = useState(
    seed.accessibilityNotes ?? "",
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit({
      name: name.trim() || "Unnamed POI",
      category,
      description: description.trim() || undefined,
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
          placeholder="Library, Lecture Hall A, …"
        />
      </Field>

      <Field label="Category">
        <Select
          value={category ?? ""}
          onChange={(e) =>
            setCategory(
              (e.target.value as POICategory) || undefined,
            )
          }
        >
          <option value="">— None —</option>
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Description">
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is this place? Who uses it?"
          rows={3}
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
 * `poi.edit-properties` — the first form-based operation.
 *
 * Phase 5d-b. Renders `EditPoiForm` inside the shell's Modal (the
 * shell handles that flow uniformly so any op with a `Form` gets the
 * same treatment). `initialArgs` reads the current POI's payload and
 * seeds the form; `invoke` PATCH-applies the gathered args via
 * `api.poi.update(id, patch)` and bumps the campus API store to
 * trigger a refresh.
 *
 * Building stand-ins (POIs with `linkedBuilding`) get their own
 * `building.edit-properties` op in a later sub-phase; this one
 * filters them out so the two never collide.
 */
export const editPoiOp: Operation<EditPoiArgs> = {
  id: "poi.edit-properties",
  label: "Edit POI",
  icon: EditIcon,
  scope: ["campus.poi"],
  Form: EditPoiForm,
  applies: (sel, entities) => {
    if (!sel.focusedId) return false;
    const entity = entities.byId(sel.focusedId);
    if (!entity || entity.typeId !== "campus.poi") return false;
    const payload = entity.payload as { linkedBuilding?: unknown };
    return !payload.linkedBuilding;
  },
  initialArgs(ctx, on) {
    const id = on[0];
    if (!id) return undefined;
    const entity = ctx.entities.byId(id);
    if (!entity) return undefined;
    const poi = entity.payload as POI;
    return {
      name: poi.name ?? "",
      category: poi.category,
      description: poi.description,
      wheelchairAccessible: poi.accessibility?.wheelchairAccessible ?? false,
      accessibilityNotes: poi.accessibility?.notes,
    };
  },
  async invoke(ctx, args, on) {
    const id = on[0];
    if (!id) return { ok: false, reason: "No POI id passed" };
    const api = useCampusApiStore.getState().api;
    if (!api) return { ok: false, reason: "Campus API not ready" };

    // Build a minimal patch — only set `accessibility` when the
    // wheelchair flag is on (or notes exist), otherwise leave it
    // undefined to preserve any other fields the form doesn't know about.
    const hasAccess = args.wheelchairAccessible || !!args.accessibilityNotes;
    api.poi.update(id, {
      name: args.name,
      category: args.category,
      description: args.description,
      accessibility: hasAccess
        ? {
            wheelchairAccessible: args.wheelchairAccessible,
            notes: args.accessibilityNotes,
          }
        : undefined,
    });
    useCampusApiStore.getState().bump();

    ctx.toast(`Saved ${args.name}`, "success");
    return { ok: true };
  },
};
