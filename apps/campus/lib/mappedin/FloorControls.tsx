"use client";

import { Select, cn } from "@klorad/design-system";

/** A switchable level — a floor or a building. Just `{ id, name }`. */
export interface FloorOption {
  id: string;
  name: string;
}

export interface FloorControlsProps {
  /** Floors of the current building, top floor first. */
  floors: FloorOption[];
  currentFloorId: string;
  /** Buildings (MappedIn floor-stacks); the selector hides if ≤ 1. */
  buildings: FloorOption[];
  currentBuildingId: string;
  onSelectFloor: (floorId: string) => void;
  onSelectBuilding: (buildingId: string) => void;
  className?: string;
}

/**
 * Exploration controls for the MappedIn viewer — a building picker
 * (multi-building venues only) above a vertical floor stack. Lets a
 * visitor freely move through the venue, not just follow directions.
 */
export function FloorControls({
  floors,
  currentFloorId,
  buildings,
  currentBuildingId,
  onSelectFloor,
  onSelectBuilding,
  className,
}: FloorControlsProps) {
  const multiBuilding = buildings.length > 1;
  // Nothing to switch — don't render an empty control.
  if (!multiBuilding && floors.length <= 1) return null;

  return (
    <div
      className={cn(
        "flex w-44 flex-col gap-2 rounded-2xl border border-line-soft bg-surface-1/95 p-2 shadow-glass backdrop-blur",
        className,
      )}
    >
      {multiBuilding ? (
        <Select
          value={currentBuildingId}
          onChange={(e) => onSelectBuilding(e.target.value)}
          aria-label="Building"
        >
          {buildings.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
      ) : null}

      {floors.length > 1 ? (
        <div className="flex max-h-[40vh] flex-col gap-1 overflow-y-auto">
          {floors.map((floor) => {
            const active = floor.id === currentFloorId;
            return (
              <button
                key={floor.id}
                type="button"
                onClick={() => onSelectFloor(floor.id)}
                aria-pressed={active}
                className={cn(
                  "shrink-0 truncate rounded-xl px-3 py-2 text-xs font-medium transition-colors",
                  active
                    ? "bg-accent text-accent-contrast"
                    : "text-text-secondary hover:bg-accent-soft hover:text-accent",
                )}
              >
                {floor.name}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
