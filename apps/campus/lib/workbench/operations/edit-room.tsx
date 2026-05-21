"use client";

import { useState } from "react";
import type { Room, RoomType } from "@klorad/api";
import { Button, Field, Input, Select } from "@klorad/design-system";
import type {
  Operation,
  OperationFormProps,
} from "@klorad/config/workbench";
import { useCampusApiStore } from "../campus-api-store";

export interface EditRoomArgs {
  name: string;
  roomNumber?: string;
  type: RoomType;
  heightM?: number;
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

const TYPE_OPTIONS: { value: RoomType; label: string }[] = [
  { value: "office", label: "Office" },
  { value: "classroom", label: "Classroom" },
  { value: "lab", label: "Lab" },
  { value: "amphitheatre", label: "Amphitheatre" },
  { value: "library", label: "Library" },
  { value: "cafe", label: "Café" },
  { value: "wc", label: "Restroom" },
  { value: "utility", label: "Utility" },
  { value: "corridor", label: "Corridor" },
  { value: "other", label: "Other" },
];

function EditRoomForm({
  initialArgs,
  submit,
  cancel,
}: OperationFormProps<EditRoomArgs>) {
  const seed: EditRoomArgs = initialArgs ?? { name: "", type: "other" };
  const [name, setName] = useState(seed.name);
  const [roomNumber, setRoomNumber] = useState(seed.roomNumber ?? "");
  const [type, setType] = useState<RoomType>(seed.type);
  const [height, setHeight] = useState(
    seed.heightM != null ? String(seed.heightM) : "",
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedHeight = height.trim() ? Number(height) : undefined;
    submit({
      name: name.trim() || "Unnamed room",
      roomNumber: roomNumber.trim() || undefined,
      type,
      heightM: Number.isFinite(parsedHeight) ? parsedHeight : undefined,
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Name">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Office 204, Lab A, …"
          autoFocus
        />
      </Field>
      <Field label="Room number">
        <Input
          value={roomNumber}
          onChange={(e) => setRoomNumber(e.target.value)}
          placeholder="e.g. B3-204"
        />
      </Field>
      <Field label="Type">
        <Select value={type} onChange={(e) => setType(e.target.value as RoomType)}>
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Height (metres)">
        <Input
          value={height}
          onChange={(e) => setHeight(e.target.value)}
          placeholder="3 (default)"
          type="number"
          min={0}
        />
      </Field>
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
 * `room.edit-properties` — edit a room's headline metadata.
 *
 * Phase 5d-g. Polygon editing (drag vertices) is a separate heavier
 * op (`room.reshape`, deferred); this one covers name / room number
 * / type / per-room height.
 */
export const editRoomOp: Operation<EditRoomArgs> = {
  id: "room.edit-properties",
  label: "Edit room",
  icon: EditIcon,
  scope: ["campus.room"],
  Form: EditRoomForm,
  applies: (sel, entities) => {
    if (!sel.focusedId) return false;
    return entities.byId(sel.focusedId)?.typeId === "campus.room";
  },
  initialArgs(ctx, on) {
    const id = on[0];
    if (!id) return undefined;
    const entity = ctx.entities.byId(id);
    if (!entity) return undefined;
    const room = entity.payload as Room;
    return {
      name: room.name ?? "",
      roomNumber: room.roomNumber,
      type: room.type,
      heightM: room.heightM,
    };
  },
  async invoke(ctx, args, on) {
    const id = on[0];
    if (!id) return { ok: false, reason: "No room id passed" };
    const api = useCampusApiStore.getState().api;
    if (!api) return { ok: false, reason: "Campus API not ready" };

    api.rooms.update(id, {
      name: args.name,
      roomNumber: args.roomNumber,
      type: args.type,
      heightM: args.heightM,
    });
    useCampusApiStore.getState().bump();

    ctx.toast(`Saved ${args.name}`, "success");
    return { ok: true };
  },
};
