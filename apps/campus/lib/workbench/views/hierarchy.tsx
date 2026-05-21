"use client";

import { useMemo, useState } from "react";
import type { FloorPlan, POI } from "@klorad/api";
import type { Entity, View, ViewProps } from "@klorad/config/workbench";
import { ContextMenu, cn } from "@klorad/design-system";
import type { Building } from "../entities/building";

/**
 * Phase 4c → modern lite — HierarchyView.
 *
 * Same direction as the table: drop heavy borders / surface-1 cards
 * in favour of indentation, hover-only highlights, and a tiny accent
 * dot for the active row. Buildings get a single-line row with a
 * chevron + name + a compact "N · M" count chip; children indent
 * under a thin accent guideline when expanded.
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

  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    entityId: string;
  } | null>(null);
  const openMenu = (e: React.MouseEvent, entityId: string) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, entityId });
  };

  const isEmpty = buildings.length === 0 && standalonePois.length === 0;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 px-4 pt-1 pb-3">
        <h2 className="text-base font-semibold tracking-tight text-text-primary">
          Hierarchy
        </h2>
        {buildings.length > 0 ? (
          <span className="inline-flex items-center rounded-full bg-accent-soft px-2 py-0.5 text-[0.7rem] font-semibold tabular-nums text-accent">
            {buildings.length}
          </span>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 space-y-1 overflow-auto px-2 pb-3">
        {isEmpty ? (
          <EmptyHierarchy />
        ) : (
          <>
            {buildings.map((b) => {
              const open = expanded.has(b.id);
              const children = childPoisByBuilding.get(b.id) ?? [];
              const floors = floorsByBuilding.get(b.id) ?? [];
              const isSelected = focusedId === b.id;
              return (
                <div key={b.id}>
                  <BuildingRow
                    name={b.payload.name || "Unnamed building"}
                    open={open}
                    selected={isSelected}
                    floors={floors.length}
                    pois={children.length}
                    onToggle={() => toggleExpanded(b.id)}
                    onSelect={() => select(b.id)}
                    onContextMenu={(e) => openMenu(e, b.id)}
                  />
                  {open ? (
                    <div className="ml-5 mt-0.5 space-y-px border-l border-line-soft pl-1.5">
                      {floors.length === 0 && children.length === 0 ? (
                        <p className="px-2 py-1 text-[0.7rem] italic text-text-tertiary">
                          Empty
                        </p>
                      ) : null}
                      {floors.map((f) => (
                        <FloorRow
                          key={f.id}
                          floor={f.payload}
                          selected={focusedId === f.id}
                          onSelect={() => select(f.id)}
                          onContextMenu={(e) => openMenu(e, f.id)}
                        />
                      ))}
                      {children.map((p) => (
                        <PoiRow
                          key={p.id}
                          poi={p.payload}
                          selected={focusedId === p.id}
                          onSelect={() => select(p.id)}
                          onContextMenu={(e) => openMenu(e, p.id)}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}

            {standalonePois.length > 0 ? (
              <section className="mt-3 space-y-px">
                <header className="flex items-center gap-2 px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                  Unbuilt
                  <span className="inline-flex items-center rounded-full bg-surface-2 px-1.5 py-0.5 text-[0.65rem] font-semibold tabular-nums">
                    {standalonePois.length}
                  </span>
                </header>
                {standalonePois.map((p) => (
                  <PoiRow
                    key={p.id}
                    poi={p.payload}
                    selected={focusedId === p.id}
                    onSelect={() => select(p.id)}
                    onContextMenu={(e) => openMenu(e, p.id)}
                  />
                ))}
              </section>
            ) : null}
          </>
        )}
      </div>

      {menu ? (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          operations={ctx.operationsForEntity(menu.entityId)}
          onRun={(resolved) =>
            void ctx.runOperation(
              resolved.operation.id,
              undefined,
              resolved.on,
            )
          }
          onClose={() => setMenu(null)}
        />
      ) : null}
    </div>
  );
}

/** One building — single-line row with chevron + name + tiny count chip. */
function BuildingRow({
  name,
  open,
  selected,
  floors,
  pois,
  onToggle,
  onSelect,
  onContextMenu,
}: {
  name: string;
  open: boolean;
  selected: boolean;
  floors: number;
  pois: number;
  onToggle: () => void;
  onSelect: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-1 rounded-full px-1.5 py-1 transition-colors",
        selected
          ? "bg-accent-soft text-accent"
          : "text-text-secondary hover:bg-surface-2 hover:text-text-primary",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={open ? "Collapse" : "Expand"}
        aria-expanded={open}
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-inherit transition-colors",
          selected ? "text-accent" : "text-text-tertiary",
        )}
      >
        <Chevron open={open} />
      </button>
      <button
        type="button"
        onClick={onSelect}
        onContextMenu={onContextMenu}
        aria-pressed={selected}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <BuildingIcon
          className={cn(
            "h-3.5 w-3.5 shrink-0 transition-colors",
            selected ? "text-accent" : "text-text-tertiary",
          )}
        />
        <span className="truncate text-[0.8125rem] font-medium">{name}</span>
      </button>
      <span
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-medium tabular-nums transition-colors",
          selected
            ? "bg-accent/15 text-accent"
            : "bg-surface-2 text-text-tertiary group-hover:bg-bg",
        )}
      >
        {floors} · {pois}
      </span>
    </div>
  );
}

function FloorRow({
  floor,
  selected,
  onSelect,
  onContextMenu,
}: {
  floor: FloorPlan;
  selected: boolean;
  onSelect: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const label =
    floor.name ??
    (floor.floor !== undefined ? `Floor ${floor.floor}` : "Floor");
  const code = floorCode(floor.floor);
  return (
    <button
      type="button"
      onClick={onSelect}
      onContextMenu={onContextMenu}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center gap-2 rounded-full px-2 py-1 text-left transition-colors",
        selected
          ? "bg-accent-soft text-accent"
          : "text-text-secondary hover:bg-surface-2 hover:text-text-primary",
      )}
    >
      <span
        className={cn(
          "inline-flex h-4 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full px-1 font-mono text-[0.6rem] tabular-nums transition-colors",
          selected
            ? "bg-accent text-accent-contrast"
            : "bg-surface-2 text-text-tertiary",
        )}
      >
        {code}
      </span>
      <span className="truncate text-[0.75rem]">{label}</span>
    </button>
  );
}

function PoiRow({
  poi,
  selected,
  onSelect,
  onContextMenu,
}: {
  poi: POI;
  selected: boolean;
  onSelect: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const isAccessible = !!poi.accessibility?.wheelchairAccessible;
  return (
    <button
      type="button"
      onClick={onSelect}
      onContextMenu={onContextMenu}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center gap-2 rounded-full px-2 py-1 text-left transition-colors",
        selected
          ? "bg-accent-soft text-accent"
          : "text-text-secondary hover:bg-surface-2 hover:text-text-primary",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "inline-block h-1.5 w-1.5 shrink-0 rounded-full transition-colors",
          selected ? "bg-accent" : "bg-text-tertiary/40",
        )}
      />
      <span className="flex-1 truncate text-[0.75rem]">
        {poi.name || "Unnamed POI"}
      </span>
      {isAccessible ? (
        <span
          aria-label="Accessible"
          title="Accessible"
          className={cn(
            "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
            selected ? "bg-accent" : "bg-accent/60",
          )}
        />
      ) : null}
    </button>
  );
}

/** Compact floor label: ground = G, basements = "1B"/"2B", upper = "1F"/"2F". */
function floorCode(floor?: number): string {
  if (floor === undefined) return "—";
  if (floor === 0) return "G";
  return floor > 0 ? `${floor}F` : `${Math.abs(floor)}B`;
}

function EmptyHierarchy() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
        <BuildingIcon className="h-4 w-4" />
      </span>
      <p className="text-[0.8125rem] font-medium text-text-primary">
        Nothing here yet
      </p>
      <p className="text-[0.7rem] text-text-tertiary">
        Draw a building or place a POI to fill the tree.
      </p>
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("transition-transform", open ? "rotate-90" : "")}
      aria-hidden
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("shrink-0", className)}
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
