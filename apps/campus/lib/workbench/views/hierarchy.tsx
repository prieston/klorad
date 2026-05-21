"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { FloorPlan, POI } from "@klorad/api";
import type { Entity, View, ViewProps } from "@klorad/config/workbench";
import { ContextMenu, cn } from "@klorad/design-system";
import type { Building } from "../entities/building";

/**
 * Phase 4c → modernised — HierarchyView.
 *
 * Buildings as cards rather than tree-rows. Each building is a
 * rounded card with:
 *   - a building icon + name as the header
 *   - a compact metadata strip (floors · POIs · accessibility)
 *   - chevron to expand / collapse
 *   - when expanded, nested floor + POI rows in a tighter style
 *
 * "Unbuilt" POIs (no parent building) live in a separate section
 * at the bottom, also card-styled for consistency.
 *
 * Selection: full accent-soft background on the active row, accent
 * ring on the active card. Right-click works on every row, surfacing
 * `ctx.operationsForEntity(...)` via the DS ContextMenu.
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
      <header className="space-y-1 px-4 pb-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-text-primary">
            Hierarchy
          </h2>
          <span className="text-[0.7rem] tabular-nums text-text-tertiary">
            {buildings.length} building{buildings.length === 1 ? "" : "s"}
          </span>
        </div>
        <p className="text-[0.7rem] text-text-tertiary">
          {standalonePois.length} unbuilt POI
          {standalonePois.length === 1 ? "" : "s"}
        </p>
      </header>

      <div className="min-h-0 flex-1 space-y-2 overflow-auto px-3 pb-3">
        {isEmpty ? (
          <EmptyHierarchy />
        ) : (
          <>
            {buildings.map((b) => {
              const open = expanded.has(b.id);
              const children = childPoisByBuilding.get(b.id) ?? [];
              const floors = floorsByBuilding.get(b.id) ?? [];
              const isSelected = focusedId === b.id;
              const hasContents = floors.length + children.length > 0;
              return (
                <BuildingCard
                  key={b.id}
                  open={open}
                  selected={isSelected}
                  onToggle={() => toggleExpanded(b.id)}
                  onSelect={() => select(b.id)}
                  onContextMenu={(e) => openMenu(e, b.id)}
                  name={b.payload.name || "Unnamed building"}
                  floorCount={floors.length}
                  poiCount={children.length}
                >
                  {open ? (
                    <div className="space-y-1 px-3 pb-3">
                      {!hasContents ? (
                        <p className="text-[0.7rem] italic text-text-tertiary">
                          No floors or POIs in here yet.
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
                </BuildingCard>
              );
            })}

            {standalonePois.length > 0 ? (
              <section className="space-y-1 rounded-2xl border border-dashed border-line-soft p-3">
                <header className="px-1 pb-1 text-[0.65rem] uppercase tracking-[0.14em] text-text-tertiary">
                  Unbuilt POIs
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

/**
 * One building rendered as a rounded card. Header is clickable to
 * select; chevron toggles expansion independently.
 */
function BuildingCard({
  name,
  selected,
  open,
  floorCount,
  poiCount,
  onToggle,
  onSelect,
  onContextMenu,
  children,
}: {
  name: string;
  selected: boolean;
  open: boolean;
  floorCount: number;
  poiCount: number;
  onToggle: () => void;
  onSelect: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  children?: ReactNode;
}) {
  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border bg-surface-1 transition-colors",
        selected
          ? "border-accent shadow-[0_0_0_1px_var(--accent)]"
          : "border-line-soft hover:border-line-strong",
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={onToggle}
          aria-label={open ? "Collapse" : "Expand"}
          aria-expanded={open}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-accent-soft hover:text-text-primary"
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
          <span
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors",
              selected
                ? "border-accent bg-accent text-accent-contrast"
                : "border-line-soft bg-surface-1 text-text-tertiary",
            )}
          >
            <BuildingIcon className="h-3.5 w-3.5" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span
              className={cn(
                "truncate text-sm font-medium",
                selected ? "text-accent" : "text-text-primary",
              )}
            >
              {name}
            </span>
            <span className="truncate text-[0.7rem] text-text-tertiary">
              {floorCount} floor{floorCount === 1 ? "" : "s"} · {poiCount} POI
              {poiCount === 1 ? "" : "s"}
            </span>
          </div>
        </button>
      </div>
      {children}
    </article>
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
  return (
    <button
      type="button"
      onClick={onSelect}
      onContextMenu={onContextMenu}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors",
        selected
          ? "bg-accent-soft text-accent"
          : "text-text-secondary hover:bg-surface-2 hover:text-text-primary",
      )}
    >
      <FloorBadge floor={floor.floor} selected={selected} />
      <span className="flex-1 truncate text-[0.8125rem]">{label}</span>
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
  return (
    <button
      type="button"
      onClick={onSelect}
      onContextMenu={onContextMenu}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors",
        selected
          ? "bg-accent-soft text-accent"
          : "text-text-secondary hover:bg-surface-2 hover:text-text-primary",
      )}
    >
      <span
        className={cn(
          "inline-block h-1.5 w-1.5 shrink-0 rounded-full transition-colors",
          selected ? "bg-accent" : "bg-text-tertiary",
        )}
      />
      <span className="flex-1 truncate text-[0.8125rem]">
        {poi.name || "Unnamed POI"}
      </span>
      {poi.accessibility?.wheelchairAccessible ? (
        <span
          aria-hidden
          title="Accessible"
          className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
        />
      ) : null}
    </button>
  );
}

/** Small numeric chip showing the floor number. Negative = basement. */
function FloorBadge({
  floor,
  selected,
}: {
  floor?: number;
  selected: boolean;
}) {
  const display =
    floor === undefined
      ? "—"
      : floor > 0
        ? `${floor}F`
        : floor === 0
          ? "G"
          : `${Math.abs(floor)}B`;
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-[1.5rem] shrink-0 items-center justify-center rounded-md border px-1 font-mono text-[0.65rem] tabular-nums transition-colors",
        selected
          ? "border-accent text-accent"
          : "border-line-soft text-text-tertiary",
      )}
    >
      {display}
    </span>
  );
}

function EmptyHierarchy() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-line-soft text-text-tertiary">
        <BuildingIcon className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-text-primary">
          Nothing here yet
        </p>
        <p className="text-[0.7rem] text-text-tertiary">
          Draw a building or place a POI and the tree fills itself.
        </p>
      </div>
    </div>
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
