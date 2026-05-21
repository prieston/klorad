"use client";

import {
  WorkbenchOperationButton,
  WorkbenchSection,
  WorkbenchStatTile,
} from "@klorad/design-system";
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
 *
 * Phase 5c1 — operations render generically from
 * `ctx.applicableOperations`. Add a new op to `workbench.config.ts`
 * and it shows up in the SelectionPanel automatically.
 *
 * Style pass — built on `@klorad/design-system`'s `WorkbenchSection`,
 * `WorkbenchStatTile`, and `WorkbenchOperationButton` so the view
 * matches the dashboard's `rounded-2xl` / Panel aesthetic. Future
 * verticals' OverviewViews inherit the same primitives.
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
    const payload = p.payload as {
      accessibility?: { wheelchairAccessible?: boolean };
    };
    return payload?.accessibility?.wheelchairAccessible;
  }).length;
  const accessibilityPct =
    pois.length > 0 ? Math.round((accessibleCount / pois.length) * 100) : 0;

  // Short worldId for the subtitle — full id is preserved on hover.
  const shortWorldId = ctx.worldId.length > 12
    ? `${ctx.worldId.slice(0, 6)}…${ctx.worldId.slice(-4)}`
    : ctx.worldId;

  return (
    <div className="flex h-full flex-col gap-4 px-4 pb-4">
      <header className="space-y-1">
        <h2 className="text-base font-semibold text-text-primary">Overview</h2>
        <p
          className="font-mono text-[0.7rem] text-text-tertiary"
          title={ctx.worldId}
        >
          {shortWorldId}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <WorkbenchStatTile label="POIs" value={pois.length} />
        <WorkbenchStatTile label="Buildings" value={buildings.length} />
        <WorkbenchStatTile label="Floor plans" value={floorPlans.length} />
        <WorkbenchStatTile label="Events" value={events.length} />
      </div>

      <WorkbenchSection title="Accessibility coverage">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-light tabular-nums text-text-primary">
            {accessibilityPct}%
          </span>
          <span className="text-xs text-text-secondary">
            {accessibleCount} / {pois.length} POIs
          </span>
        </div>
      </WorkbenchSection>

      <SelectionPanel ctx={ctx} />
      <WorldActions ctx={ctx} />
    </div>
  );
}

/**
 * World-level operations (`scope: []`) — `world.open-viewer`,
 * `world.copy-link`, plus any future ones. Rendered generically
 * from `ctx.applicableOperations`: filter `scope.length === 0`,
 * iterate. Each op declares its own `icon` + `label`, so adding a
 * new world op requires no edits here.
 *
 * `secondary` variant so these ambient actions read quieter than
 * the selection-scoped buttons above.
 */
function WorldActions({ ctx }: { ctx: ViewProps["ctx"] }) {
  const worldOps = ctx.applicableOperations.filter(
    (r) => r.operation.scope.length === 0,
  );
  if (worldOps.length === 0) return null;
  return (
    <WorkbenchSection tone="soft" title="World actions">
      <div className="flex flex-wrap gap-1.5">
        {worldOps.map(({ operation, on }) => (
          <WorkbenchOperationButton
            key={operation.id}
            label={operation.label}
            icon={operation.icon}
            variant="secondary"
            onClick={() =>
              void ctx.runOperation(operation.id, undefined, on)
            }
          />
        ))}
      </div>
    </WorkbenchSection>
  );
}

/**
 * "What's selected" — echoes the focused id and surfaces every
 * applicable entity-scoped operation. Rendered from
 * `ctx.applicableOperations` (Phase 5c1); world-level ops are
 * filtered out and surface in `WorldActions` above.
 *
 * Clear button is a UI affordance, not an operation — `OpInvokeContext`
 * deliberately doesn't carry `setSelection`. Calls `ctx.setSelection`
 * directly.
 */
function SelectionPanel({ ctx }: { ctx: ViewProps["ctx"] }) {
  const focusedId = ctx.selection.focusedId;
  const entityOps = ctx.applicableOperations.filter(
    (r) => r.operation.scope.length > 0,
  );

  const subtitle = focusedId ? (
    <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.7rem] text-text-primary">
      {focusedId}
    </code>
  ) : (
    <span className="text-xs text-text-tertiary">Nothing selected</span>
  );

  const handleClear = () => {
    ctx.setSelection({ ids: new Set<string>(), focusedId: null });
  };

  return (
    <WorkbenchSection
      tone="dashed"
      title="Selection"
      subtitle={subtitle}
      actions={
        focusedId ? (
          <button
            type="button"
            onClick={handleClear}
            className="text-[0.7rem] font-medium text-text-secondary transition-colors hover:text-accent"
          >
            Clear
          </button>
        ) : null
      }
    >
      {entityOps.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {entityOps.map(({ operation, on }) => (
            <WorkbenchOperationButton
              key={operation.id}
              label={operation.label}
              icon={operation.icon}
              onClick={() =>
                void ctx.runOperation(operation.id, undefined, on)
              }
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-text-tertiary">
          {focusedId
            ? "No actions available for this selection."
            : "Click anything on the map or in the list to see what you can do with it."}
        </p>
      )}
    </WorkbenchSection>
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
