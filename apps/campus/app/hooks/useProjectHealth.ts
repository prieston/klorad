"use client";

import { useMemo } from "react";
import type { FloorPlan, POI, Room } from "@klorad/api";

export type ActiveView = "poi" | "location" | "buildings";

export type HealthFixTarget =
  | { type: "building"; id: string }
  | { type: "floor"; id: string; buildingId: string }
  | { type: "room"; id: string; buildingId: string; floor: number; planId: string | null }
  | { type: "poi"; id: string };

export interface HealthCheck {
  /** Stable identifier so React keys don't flicker. */
  id: string;
  label: string;
  done: boolean;
}

export interface HealthIssue {
  id: string;
  label: string;
  severity: "warn" | "error";
  fix?: HealthFixTarget;
}

export interface ProjectHealth {
  counts: {
    buildings: number;
    floors: number;
    rooms: number;
    pois: number;
  };
  completeness: HealthCheck[];
  issues: HealthIssue[];
  /** A single context-aware suggestion shown at the foot of the panel. */
  tip: string;
}

interface UseProjectHealthOpts {
  pois: POI[];
  rooms: Room[];
  plans: FloorPlan[];
  activeView: ActiveView;
}

/**
 * Derives the studio's left "Project Health" rail content from the
 * current scene state. No side effects, purely a read of pois / rooms
 * / plans → counts, checklist, lints, and a one-liner tip whose copy
 * tracks the user's current right-panel view.
 */
export function useProjectHealth({
  pois,
  rooms,
  plans,
  activeView,
}: UseProjectHealthOpts): ProjectHealth {
  return useMemo(() => {
    const buildings = pois.filter((p) => p.linkedBuilding);
    const buildingIds = new Set(buildings.map((b) => b.id));

    const counts = {
      buildings: buildings.length,
      floors: plans.length,
      rooms: rooms.length,
      pois: pois.length,
    };

    /* ---------------------------- Completeness ---------------------------- */

    const hasLocation = pois.length > 0; // any POI with a position counts
    const hasBuilding = buildings.length > 0;
    const allBuildingsHaveFloors =
      buildings.length === 0
        ? false
        : buildings.every((b) =>
            plans.some((p) => p.buildingId === b.id)
          );
    const allFloorsNamed =
      plans.length === 0
        ? true
        : plans.every((p) => Boolean(p.name?.trim()));

    const completeness: HealthCheck[] = [
      { id: "loc", label: "Location pinned", done: hasLocation },
      { id: "bld", label: "At least one building", done: hasBuilding },
      {
        id: "flr",
        label: "Every building has a floor",
        done: hasBuilding && allBuildingsHaveFloors,
      },
      { id: "fnm", label: "Floors are named", done: allFloorsNamed },
    ];

    /* ------------------------------- Issues ------------------------------- */

    const issues: HealthIssue[] = [];

    // Orphan rooms — buildingId no longer points to a building.
    rooms
      .filter((r) => !buildingIds.has(r.buildingId))
      .forEach((r) =>
        issues.push({
          id: `orphan-room-${r.id}`,
          label: `Room "${r.name}" has no building`,
          severity: "error",
        })
      );

    // Buildings with zero floors.
    buildings
      .filter((b) => !plans.some((p) => p.buildingId === b.id))
      .forEach((b) =>
        issues.push({
          id: `no-floors-${b.id}`,
          label: `${b.name}: no floors yet`,
          severity: "warn",
          fix: { type: "building", id: b.id },
        })
      );

    // Duplicate floor numbers within the same building.
    const seen = new Map<string, FloorPlan>();
    for (const p of plans) {
      const key = `${p.buildingId}:${p.floor ?? 0}`;
      const prev = seen.get(key);
      if (prev) {
        const b = buildings.find((x) => x.id === p.buildingId);
        issues.push({
          id: `dup-floor-${p.id}`,
          label: `${b?.name ?? "Building"}: two floors at index ${p.floor ?? 0}`,
          severity: "warn",
          fix: {
            type: "floor",
            id: p.id,
            buildingId: p.buildingId ?? "",
          },
        });
      } else {
        seen.set(key, p);
      }
    }

    /* -------------------------------- Tip --------------------------------- */

    let tip: string;
    if (activeView === "location") {
      tip = hasLocation
        ? "Tip: capture a hero camera pose so the share preview lands well."
        : "Tip: pin the centre of your campus to anchor the map.";
    } else if (activeView === "buildings") {
      if (!hasBuilding) {
        tip = "Tip: trace a polygon on the map to create your first building.";
      } else if (!allBuildingsHaveFloors) {
        tip = "Tip: add a floor on each building before drawing rooms.";
      } else if (counts.rooms === 0) {
        tip =
          "Tip: open a floor and trace rooms on top — each room becomes a 3D block.";
      } else {
        tip =
          "Tip: add search keywords on a room so visitors can find it by Bio 101 / microbiology.";
      }
    } else {
      tip = "Tip: drop POIs for entrances, cafés, and parking — they appear on the public map.";
    }

    return { counts, completeness, issues, tip };
  }, [pois, rooms, plans, activeView]);
}
