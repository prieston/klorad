"use client";

import { useRef, useState } from "react";
import type { POI } from "@klorad/api";
import { Button, Field, Input, Select, Spinner } from "@klorad/design-system";
import type {
  Operation,
  OperationFormProps,
} from "@klorad/config/workbench";
import { uploadFile } from "@klorad/storage/client";
import { useCampusApiStore } from "../campus-api-store";

export interface UploadFloorPlanArgs {
  url: string;
  name?: string;
  buildingId: string;
  floor: number;
  /** Closed quad in [lng, lat] — [TL, TR, BR, BL]. */
  coordinates: [
    [number, number],
    [number, number],
    [number, number],
    [number, number],
  ];
  /** Optional thumbnail preview kept around for the success toast. */
  fileName?: string;
}

function UploadIcon({ className }: { className?: string }) {
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
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

/**
 * Default coordinates for a freshly-uploaded floor plan when the user
 * doesn't draw corners themselves. Generates a small square (~80m)
 * centred on the building's centroid. Editable afterwards.
 *
 * 80m at the equator is ~0.00072° of longitude; we accept the
 * latitude distortion at higher latitudes for v1 — refining corners
 * is a separate op (`floor-plan.reposition`, deferred).
 */
function defaultQuadAround([lng, lat]: [number, number]): [
  [number, number],
  [number, number],
  [number, number],
  [number, number],
] {
  const halfSize = 0.00036; // ≈ 40m E/W half-width at the equator
  return [
    [lng - halfSize, lat + halfSize],
    [lng + halfSize, lat + halfSize],
    [lng + halfSize, lat - halfSize],
    [lng - halfSize, lat - halfSize],
  ];
}

function UploadFloorPlanForm({
  submit,
  cancel,
}: OperationFormProps<UploadFloorPlanArgs>) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [buildingId, setBuildingId] = useState("");
  const [floor, setFloor] = useState("0");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Building list — pulled at submit time from the api store so we
  // don't need to plumb entities into Form props.
  const api = useCampusApiStore((s) => s.api);
  const buildings: POI[] =
    (api?.poi.getAll() ?? []).filter((p) => Boolean(p.linkedBuilding)) ?? [];

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setFile(f ?? null);
    if (f && !name.trim()) setName(f.name.replace(/\.[^.]+$/, ""));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Pick an image first.");
      return;
    }
    if (!buildingId) {
      setError("Choose a building.");
      return;
    }
    const building = buildings.find((b) => b.id === buildingId);
    if (!building?.linkedBuilding) {
      setError("Building not found.");
      return;
    }
    const parsedFloor = Number(floor);
    if (!Number.isFinite(parsedFloor)) {
      setError("Floor number must be a number.");
      return;
    }

    setError(null);
    setUploading(true);
    setProgress(0);
    try {
      const { publicUrl } = await uploadFile(
        file,
        { prefix: "floor-plans" },
        { onProgress: (p) => setProgress(p) },
      );
      submit({
        url: publicUrl,
        name: name.trim() || undefined,
        buildingId,
        floor: parsedFloor,
        coordinates: defaultQuadAround([
          building.linkedBuilding.lng,
          building.linkedBuilding.lat,
        ]),
        fileName: file.name,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setUploading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Image">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={onPickFile}
          disabled={uploading}
          className="block w-full text-sm text-text-secondary file:mr-3 file:rounded-md file:border-0 file:bg-accent-soft file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-accent hover:file:bg-accent-soft/80"
        />
      </Field>
      <Field label="Name">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ground floor, 2nd floor, …"
          disabled={uploading}
        />
      </Field>
      <Field label="Building">
        <Select
          value={buildingId}
          onChange={(e) => setBuildingId(e.target.value)}
          disabled={uploading || buildings.length === 0}
        >
          <option value="">— Pick a building —</option>
          {buildings.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name || `Building ${b.id.slice(0, 6)}`}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Floor number">
        <Input
          value={floor}
          onChange={(e) => setFloor(e.target.value)}
          type="number"
          placeholder="0 = ground, 1 = first, -1 = basement"
          disabled={uploading}
        />
      </Field>

      {uploading ? (
        <div className="flex items-center gap-2 rounded-md bg-accent-soft px-3 py-2 text-xs text-accent">
          <Spinner />
          <span>Uploading… {Math.round(progress)}%</span>
        </div>
      ) : null}
      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : null}

      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="secondary"
          onClick={cancel}
          disabled={uploading}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={uploading}>
          {uploading ? "Uploading…" : "Upload"}
        </Button>
      </div>
    </form>
  );
}

/**
 * `floor-plan.upload` — add a new floor plan by uploading an image.
 *
 * Phase 5d-h (the last 5d piece before Phase 6b). The form:
 *
 *   1. User picks an image, name, building, floor.
 *   2. Form uploads via `@klorad/storage/client.uploadFile` (signed
 *      URL flow) and resolves with the resulting public URL.
 *   3. The op creates a FloorPlan with that URL and default corner
 *      coordinates (~80m square around the building's centroid).
 *      Users refine the corners afterwards via the existing
 *      placement / drag UI (deferred to a `floor-plan.reposition` op).
 *
 * World-level — no entity scope. Surfaces in the command palette,
 * right-click on empty map (when that lands for the map view), and
 * OverviewView's WorldActions panel.
 */
export const uploadFloorPlanOp: Operation<UploadFloorPlanArgs> = {
  id: "floor-plan.upload",
  label: "Upload floor plan",
  icon: UploadIcon,
  scope: [],
  Form: UploadFloorPlanForm,
  applies: () => true,
  async invoke(ctx, args) {
    const api = useCampusApiStore.getState().api;
    if (!api) return { ok: false, reason: "Campus API not ready" };

    const created = api.floorPlans.add({
      name: args.name,
      url: args.url,
      coordinates: args.coordinates,
      buildingId: args.buildingId,
      floor: args.floor,
      visible: true,
    });
    useCampusApiStore.getState().bump();

    ctx.toast(`Added ${created?.name ?? args.fileName ?? "floor plan"}`, "success");
    return { ok: true };
  },
};
