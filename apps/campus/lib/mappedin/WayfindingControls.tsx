"use client";

import { useState } from "react";
import { Button, Select } from "@klorad/design-system";

/** A selectable destination — a named space in the venue. */
export interface SpaceOption {
  id: string;
  name: string;
}

export interface WayfindingControlsProps {
  /** Named spaces in the venue, used to populate the pickers. */
  spaces: SpaceOption[];
  /** A route request is in flight. */
  routing: boolean;
  /** Inline error (no route, routing failed). */
  error: string | null;
  /**
   * Compute + draw a route between two spaces. `accessible` requests
   * MappedIn's step-free route — stairs avoided where alternatives exist.
   */
  onRoute: (fromId: string, toId: string, accessible: boolean) => void;
  /** Clear the drawn route. */
  onClear: () => void;
}

/**
 * The indoor directions panel — a floating glass card over the
 * MappedIn viewer. Purely presentational: it holds the two pickers'
 * local state and emits `onRoute` / `onClear`; the viewer owns the
 * SDK calls. Lives inside `lib/mappedin/` so the MappedIn surface
 * stays one isolated folder.
 */
export function WayfindingControls({
  spaces,
  routing,
  error,
  onRoute,
  onClear,
}: WayfindingControlsProps) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [accessible, setAccessible] = useState(false);
  const canRoute = from !== "" && to !== "" && from !== to && !routing;

  return (
    <div className="flex w-full flex-col gap-3 rounded-2xl border border-line-soft bg-surface-1/95 p-4 shadow-glass backdrop-blur">
      <h2 className="text-sm font-semibold text-text-primary">
        Indoor directions
      </h2>

      <label className="flex flex-col gap-1 text-xs font-medium text-text-secondary">
        From
        <Select value={from} onChange={(e) => setFrom(e.target.value)}>
          <option value="">Choose a space…</option>
          {spaces.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-text-secondary">
        To
        <Select value={to} onChange={(e) => setTo(e.target.value)}>
          <option value="">Choose a space…</option>
          {spaces.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </label>

      <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-text-secondary">
        <input
          type="checkbox"
          checked={accessible}
          onChange={(e) => setAccessible(e.target.checked)}
          className="h-4 w-4 rounded accent-accent"
        />
        Step-free route
      </label>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={onClear}>
          Clear
        </Button>
        <Button
          size="sm"
          disabled={!canRoute}
          onClick={() => onRoute(from, to, accessible)}
        >
          {routing ? "Routing…" : "Get directions"}
        </Button>
      </div>
    </div>
  );
}
