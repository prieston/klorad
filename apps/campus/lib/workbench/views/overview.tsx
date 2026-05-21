"use client";

import type { ReactNode } from "react";
import type { View, ViewProps } from "@klorad/config/workbench";

/**
 * Phase 4a — the Overview view.
 *
 * A compact landing panel that summarises the current world: how
 * many POIs / buildings / floor plans are loaded, plus simple
 * accessibility coverage. Lives in the right dock region by default
 * so it sits next to the map without competing for the centre.
 *
 * Reads everything from `ctx.entities`. No writes; no engine
 * interaction. The simplest possible "second view" — proves the
 * dock supports more than one View consuming the shared entity
 * index, and sets the pattern that TableView and HierarchyView
 * follow in Phases 4b and 4c.
 */
function OverviewViewComponent({ ctx }: ViewProps) {
  const pois = ctx.entities.byType("campus.poi");
  const buildings = ctx.entities.byType("campus.building");
  const floorPlans = ctx.entities.byType("campus.floor-plan");
  const events = ctx.entities.byType("campus.event");

  // Accessibility coverage — pulls `wheelchairAccessible` off each
  // POI's payload. Typed loosely here to avoid coupling the view to
  // the @klorad/api `POI` shape directly; if accessibility becomes a
  // first-class concept it gets its own field on `EntityType`.
  const accessibleCount = pois.filter((p) => {
    const payload = p.payload as { accessibility?: { wheelchairAccessible?: boolean } };
    return payload?.accessibility?.wheelchairAccessible;
  }).length;
  const accessibilityPct =
    pois.length > 0 ? Math.round((accessibleCount / pois.length) * 100) : 0;

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <header className="space-y-1">
        <h2 className="text-sm font-semibold text-text-primary">Overview</h2>
        <p className="font-mono text-[0.7rem] text-text-tertiary">
          {ctx.worldId}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <StatTile label="POIs" value={pois.length} />
        <StatTile label="Buildings" value={buildings.length} />
        <StatTile label="Floor plans" value={floorPlans.length} />
        <StatTile label="Events" value={events.length} />
      </div>

      <div className="rounded-lg border border-line-soft bg-surface-1 p-3">
        <div className="text-[0.7rem] uppercase tracking-[0.14em] text-text-tertiary">
          Accessibility coverage
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-2xl font-light text-text-primary">
            {accessibilityPct}%
          </span>
          <span className="text-xs text-text-secondary">
            {accessibleCount} / {pois.length} POIs
          </span>
        </div>
      </div>

      <SelectionPanel ctx={ctx} />
    </div>
  );
}

/**
 * The right-dock's "what's selected" card. Echoes the focused id and
 * surfaces operations that apply to the current selection. v1 wires
 * `poi.fly-to` — registered in `workbench.config.ts` and invoked via
 * `ctx.runOperation(...)`. Future ops light up here without further
 * shell changes.
 */
function SelectionPanel({ ctx }: { ctx: ViewProps["ctx"] }) {
  const focusedId = ctx.selection.focusedId;
  const focusedEntity = focusedId ? ctx.entities.byId(focusedId) : null;
  const canFlyToPoi = focusedEntity?.typeId === "campus.poi";

  const handleFly = () => {
    if (!focusedId) return;
    void ctx.runOperation("poi.fly-to", undefined, [focusedId]);
  };

  return (
    <div className="rounded-lg border border-dashed border-line-soft p-3 text-xs text-text-tertiary">
      <div>
        Selected:{" "}
        {focusedId ? (
          <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.7rem] text-text-primary">
            {focusedId}
          </code>
        ) : (
          <span>nothing</span>
        )}
      </div>
      {canFlyToPoi ? (
        <button
          type="button"
          onClick={handleFly}
          className="mt-2 inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-accent px-3 text-xs font-medium text-accent-contrast transition-colors hover:bg-accent-hover"
        >
          <FlyToIcon />
          Fly to in 3D
        </button>
      ) : null}
    </div>
  );
}

function FlyToIcon() {
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
      aria-hidden
    >
      <path d="M22 2 11 13" />
      <path d="m22 2-7 20-4-9-9-4z" />
    </svg>
  );
}

function StatTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-line-soft bg-surface-1 p-3">
      <div className="text-[0.7rem] uppercase tracking-[0.14em] text-text-tertiary">
        {label}
      </div>
      <div className="mt-1 text-2xl font-light text-text-primary">{value}</div>
    </div>
  );
}

function OverviewIcon({ className }: { className?: string }) {
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
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

export const overviewView: View = {
  id: "overview",
  label: "Overview",
  icon: OverviewIcon,
  entityTypes: "*",
  defaultDock: "right",
  component: OverviewViewComponent,
};
