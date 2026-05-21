"use client";

import type { ReactNode } from "react";
import type {
  ResolvedOperation,
  View,
  ViewContext,
  ViewProps,
} from "@klorad/config/workbench";

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
      <WorldActions ctx={ctx} />
    </div>
  );
}

/**
 * World-level operations — `world.open-viewer`, `world.copy-link`.
 * Apply regardless of selection so they live in their own panel.
 */
function WorldActions({ ctx }: { ctx: ViewProps["ctx"] }) {
  return (
    <div className="space-y-2">
      <div className="text-[0.7rem] uppercase tracking-[0.14em] text-text-tertiary">
        World actions
      </div>
      <div className="flex flex-wrap gap-1.5">
        <ActionButton
          onClick={() =>
            void ctx.runOperation("world.open-viewer", undefined, [])
          }
        >
          <OpenViewerIcon />
          Open viewer
        </ActionButton>
        <ActionButton
          onClick={() =>
            void ctx.runOperation("world.copy-link", undefined, [])
          }
        >
          <CopyIcon />
          Copy link
        </ActionButton>
      </div>
    </div>
  );
}

function ActionButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-7 items-center gap-1 rounded-md border border-line-strong px-2 text-[0.7rem] font-medium text-text-secondary transition-colors hover:border-accent hover:text-accent"
    >
      {children}
    </button>
  );
}

function OpenViewerIcon() {
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
      aria-hidden
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function CopyIcon() {
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
      aria-hidden
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

/**
 * The right-dock's "what's selected" card. Echoes the focused id and
 * surfaces operations that apply to the current selection.
 *
 * Phase 5c1 — rendered generically from `ctx.applicableOperations`:
 * any entity-scoped op whose `applies` predicate returns true light
 * up here automatically. To add a new op, register it in
 * `workbench.config.ts` — no edits to this view required.
 *
 * World-level ops (`scope: []`) are filtered out here; they belong
 * in a separate "World actions" surface (5c2 lands that).
 */
function SelectionPanel({ ctx }: { ctx: ViewProps["ctx"] }) {
  const focusedId = ctx.selection.focusedId;
  const entityOps = ctx.applicableOperations.filter(
    (r) => r.operation.scope.length > 0,
  );

  // Selection-clearing is a UI affordance, not an entity-level operation
  // — `OpInvokeContext` doesn't (and shouldn't) carry `setSelection`.
  // Calls the view context directly.
  const handleClear = () => {
    ctx.setSelection({ ids: new Set<string>(), focusedId: null });
  };

  return (
    <div className="rounded-lg border border-dashed border-line-soft p-3 text-xs text-text-tertiary">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate">
          Selected:{" "}
          {focusedId ? (
            <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.7rem] text-text-primary">
              {focusedId}
            </code>
          ) : (
            <span>nothing</span>
          )}
        </span>
        {focusedId ? (
          <button
            type="button"
            onClick={handleClear}
            className="shrink-0 text-[0.7rem] font-medium text-text-secondary transition-colors hover:text-accent"
          >
            Clear
          </button>
        ) : null}
      </div>
      {entityOps.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {entityOps.map((resolved) => (
            <OperationButton
              key={resolved.operation.id}
              resolved={resolved}
              ctx={ctx}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Generic button for one `ResolvedOperation`. The view doesn't know
 * what the op does — the shell handed it a bound `on` list and the
 * op's own `label` / `icon`. Clicking fires `ctx.runOperation`.
 */
function OperationButton({
  resolved,
  ctx,
}: {
  resolved: ResolvedOperation;
  ctx: ViewContext;
}) {
  const { operation, on } = resolved;
  const Icon = operation.icon;
  return (
    <button
      type="button"
      onClick={() => void ctx.runOperation(operation.id, undefined, on)}
      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-accent px-3 text-xs font-medium text-accent-contrast transition-colors hover:bg-accent-hover"
    >
      {Icon ? <Icon className="h-3 w-3" /> : null}
      {operation.label}
    </button>
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
