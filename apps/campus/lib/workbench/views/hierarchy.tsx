"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { FloorPlan, POI } from "@klorad/api";
import type { Entity, View, ViewProps } from "@klorad/config/workbench";
import type { Building } from "../entities/building";

/**
 * Phase 4c — HierarchyView.
 *
 * A collapsible tree of Building → (FloorPlans + child POIs), with
 * a flat "Unbuilt" section underneath for POIs that don't belong to
 * a building. Lives in the left dock, stacked under TableView.
 *
 * - Buildings come from `ctx.entities.byType("campus.building")`.
 * - Child POIs are matched by `payload.parentBuildingId === building.id`.
 * - Floor plans are matched by `payload.buildingId === building.id`.
 * - Standalone POIs are POIs without a `parentBuildingId` that aren't
 *   themselves Building-entities.
 *
 * Clicking any leaf or building name fires `ctx.setSelection(...)`.
 * The 3D scene + table + overview all react via the shared selection.
 *
 * Local UI state: which buildings are expanded. Selection state
 * lives in the shell.
 */
function HierarchyViewComponent({ ctx }: ViewProps) {
  const buildings = ctx.entities.byType(
    "campus.building",
  ) as Entity<Building>[];
  const allPois = ctx.entities.byType("campus.poi") as Entity<POI>[];
  const allFloorPlans = ctx.entities.byType(
    "campus.floor-plan",
  ) as Entity<FloorPlan>[];

  const buildingIdSet = useMemo(
    () => new Set(buildings.map((b) => b.id)),
    [buildings],
  );

  const childPoisByBuilding = useMemo(() => {
    const map = new Map<string, Entity<POI>[]>();
    for (const p of allPois) {
      const pid = p.payload.parentBuildingId;
      if (pid && buildingIdSet.has(pid)) {
        const existing = map.get(pid);
        if (existing) existing.push(p);
        else map.set(pid, [p]);
      }
    }
    return map;
  }, [allPois, buildingIdSet]);

  const floorsByBuilding = useMemo(() => {
    const map = new Map<string, Entity<FloorPlan>[]>();
    for (const fp of allFloorPlans) {
      const bid = fp.payload.buildingId;
      if (bid && buildingIdSet.has(bid)) {
        const existing = map.get(bid);
        if (existing) existing.push(fp);
        else map.set(bid, [fp]);
      }
    }
    // Sort floor plans by floor number where available.
    for (const list of map.values()) {
      list.sort((a, b) => (a.payload.floor ?? 0) - (b.payload.floor ?? 0));
    }
    return map;
  }, [allFloorPlans, buildingIdSet]);

  const standalonePois = useMemo(
    () =>
      allPois.filter(
        (p) => !p.payload.parentBuildingId && !buildingIdSet.has(p.id),
      ),
    [allPois, buildingIdSet],
  );

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const focusedId = ctx.selection.focusedId;
  const select = (id: string) => {
    const next = focusedId === id ? null : id;
    ctx.setSelection({
      ids: next ? new Set([next]) : new Set<string>(),
      focusedId: next,
    });
  };

  const isEmpty = buildings.length === 0 && standalonePois.length === 0;

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-line-soft px-4 py-3">
        <h2 className="text-sm font-semibold text-text-primary">Hierarchy</h2>
        <p className="mt-0.5 text-[0.7rem] text-text-tertiary">
          {buildings.length} building{buildings.length === 1 ? "" : "s"} ·{" "}
          {standalonePois.length} unbuilt
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-auto py-1">
        {isEmpty ? (
          <div className="px-4 py-6 text-center text-xs text-text-tertiary">
            Nothing in this world yet.
          </div>
        ) : (
          <>
            {buildings.map((b) => {
              const open = expanded.has(b.id);
              const children = childPoisByBuilding.get(b.id) ?? [];
              const floors = floorsByBuilding.get(b.id) ?? [];
              const isSelected = focusedId === b.id;
              return (
                <div key={b.id}>
                  <div className="flex items-stretch">
                    <button
                      type="button"
                      onClick={() => toggleExpanded(b.id)}
                      className="flex w-7 shrink-0 items-center justify-center text-text-tertiary hover:text-text-primary"
                      aria-label={open ? "Collapse" : "Expand"}
                      aria-expanded={open}
                    >
                      <Chevron open={open} />
                    </button>
                    <button
                      type="button"
                      onClick={() => select(b.id)}
                      aria-pressed={isSelected}
                      className={
                        "flex flex-1 items-center gap-1.5 truncate py-1.5 pr-3 text-left text-sm transition-colors " +
                        (isSelected
                          ? "font-medium text-accent"
                          : "text-text-primary hover:text-accent")
                      }
                    >
                      <BuildingIcon />
                      <span className="truncate">
                        {b.payload.name || "Unnamed building"}
                      </span>
                    </button>
                  </div>

                  {open ? (
                    <div className="ml-3.5 border-l border-line-soft pl-1.5 pb-1">
                      {floors.length === 0 && children.length === 0 ? (
                        <Leaf>
                          <span className="italic">
                            No floors or child POIs
                          </span>
                        </Leaf>
                      ) : null}
                      {floors.map((f) => (
                        <Leaf
                          key={f.id}
                          icon={<FloorIcon />}
                          label={
                            f.payload.name ??
                            (f.payload.floor !== undefined
                              ? `Floor ${f.payload.floor}`
                              : "Floor")
                          }
                          selected={focusedId === f.id}
                          onSelect={() => select(f.id)}
                        />
                      ))}
                      {children.map((p) => (
                        <Leaf
                          key={p.id}
                          icon={<PoiIcon />}
                          label={p.payload.name || "Unnamed POI"}
                          selected={focusedId === p.id}
                          onSelect={() => select(p.id)}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}

            {standalonePois.length > 0 ? (
              <>
                <div className="border-t border-line-soft px-4 pt-3 pb-1 text-[0.65rem] uppercase tracking-[0.14em] text-text-tertiary">
                  Unbuilt POIs
                </div>
                {standalonePois.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => select(p.id)}
                    aria-pressed={focusedId === p.id}
                    className={
                      "flex w-full items-center gap-1.5 truncate px-4 py-1.5 text-left text-sm transition-colors " +
                      (focusedId === p.id
                        ? "bg-accent-soft font-medium text-accent"
                        : "text-text-secondary hover:text-text-primary")
                    }
                  >
                    <PoiIcon />
                    <span className="truncate">
                      {p.payload.name || "Unnamed POI"}
                    </span>
                  </button>
                ))}
              </>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function Leaf({
  icon,
  label,
  selected,
  onSelect,
  children,
}: {
  icon?: ReactNode;
  label?: string;
  selected?: boolean;
  onSelect?: () => void;
  children?: ReactNode;
}) {
  if (!onSelect) {
    return (
      <div className="flex items-center gap-1.5 py-1 pl-2 pr-3 text-xs text-text-tertiary">
        {children}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={
        "flex w-full items-center gap-1.5 truncate py-1 pl-2 pr-3 text-left text-[0.8125rem] transition-colors " +
        (selected
          ? "font-medium text-accent"
          : "text-text-secondary hover:text-text-primary")
      }
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={"transition-transform " + (open ? "rotate-90" : "")}
      aria-hidden
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function BuildingIcon() {
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
      className="shrink-0"
      aria-hidden
    >
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <line x1="9" y1="7" x2="9" y2="7" />
      <line x1="15" y1="7" x2="15" y2="7" />
      <line x1="9" y1="12" x2="9" y2="12" />
      <line x1="15" y1="12" x2="15" y2="12" />
      <line x1="9" y1="17" x2="15" y2="17" />
    </svg>
  );
}

function FloorIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      className="shrink-0"
      aria-hidden
    >
      <line x1="3" y1="8" x2="21" y2="8" />
      <line x1="3" y1="16" x2="21" y2="16" />
    </svg>
  );
}

function PoiIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden
    >
      <path d="M12 21s-7-6.5-7-12a7 7 0 1 1 14 0c0 5.5-7 12-7 12Z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

function HierarchyIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <line x1="9" y1="6" x2="20" y2="6" />
      <line x1="11" y1="12" x2="20" y2="12" />
      <line x1="13" y1="18" x2="20" y2="18" />
      <path d="M4 4v14a2 2 0 0 0 2 2h2" />
      <path d="M6 12h4" />
    </svg>
  );
}

export const hierarchyView: View = {
  id: "hierarchy",
  label: "Hierarchy",
  icon: HierarchyIcon,
  entityTypes: ["campus.building", "campus.poi", "campus.floor-plan"],
  defaultDock: "left",
  component: HierarchyViewComponent,
};
