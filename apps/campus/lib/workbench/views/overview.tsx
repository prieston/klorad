"use client";

import {
  WorkbenchOperationButton,
  cn,
} from "@klorad/design-system";
import type { View, ViewProps } from "@klorad/config/workbench";

/**
 * The Overview view — right dock summary.
 *
 * Restyled to match platform.klorad's hairline-grid + bg-bg cell
 * treatment. The dock column itself is `surface-1` (white in light
 * mode), so cards using `bg-surface-1` would disappear; instead we
 * use `bg-bg` cells inside `bg-line-soft` containers, the same
 * pattern the platform's "Built in" capabilities section uses.
 *
 * Sections, top to bottom:
 *   - Header — title + shortened worldId
 *   - Stats — 2×2 hairline grid (POIs, Buildings, Floor plans, Events)
 *   - Accessibility coverage card
 *   - Selection card (entity ops)
 *
 * World-level actions (Save, Share, Open viewer, Publish) live in the
 * `WorkbenchTopBar` — they act on the whole campus, not a selection.
 */
function OverviewViewComponent({ ctx }: ViewProps) {
  const pois = ctx.entities.byType("campus.poi");
  const buildings = ctx.entities.byType("campus.building");
  const floorPlans = ctx.entities.byType("campus.floor-plan");
  const events = ctx.entities.byType("campus.event");

  const accessibleCount = pois.filter((p) => {
    const payload = p.payload as {
      accessibility?: { wheelchairAccessible?: boolean };
    };
    return payload?.accessibility?.wheelchairAccessible;
  }).length;
  const accessibilityPct =
    pois.length > 0 ? Math.round((accessibleCount / pois.length) * 100) : 0;

  const shortWorldId =
    ctx.worldId.length > 12
      ? `${ctx.worldId.slice(0, 6)}…${ctx.worldId.slice(-4)}`
      : ctx.worldId;

  return (
    // The right dock column is flex-1 inside a flex column; without
    // `min-h-0` + `overflow-y-auto` here, our content blows past the
    // viewport with no scrollbar. `min-w-0 + overflow-x-hidden`
    // belt-and-braces against long worldIds / button labels.
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-4 overflow-y-auto overflow-x-hidden px-4 pb-4">
      <header className="min-w-0 space-y-1 pt-1">
        <h2 className="text-base font-semibold tracking-tight text-text-primary">
          Overview
        </h2>
        <p
          className="truncate font-mono text-[0.7rem] text-text-tertiary"
          title={ctx.worldId}
        >
          {shortWorldId}
        </p>
      </header>

      {/* Hairline-grid stats — bg-bg cells visible against the white
          dock, gap-px hairlines between them. */}
      <div className="grid w-full grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line-soft bg-line-soft">
        <StatCell label="POIs" value={pois.length} />
        <StatCell label="Buildings" value={buildings.length} />
        <StatCell label="Floor plans" value={floorPlans.length} />
        <StatCell label="Events" value={events.length} />
      </div>

      <Card title="Accessibility coverage">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-light tabular-nums leading-none text-text-primary">
            {accessibilityPct}%
          </span>
          <span className="truncate text-xs text-text-secondary">
            {accessibleCount} / {pois.length} POIs
          </span>
        </div>
      </Card>

      <SelectionPanel ctx={ctx} />
    </div>
  );
}

/** One stat cell — large number over a small caps label. */
function StatCell({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="min-w-0 overflow-hidden bg-bg p-4">
      <div className="truncate text-[0.65rem] font-medium uppercase tracking-[0.14em] text-text-tertiary">
        {label}
      </div>
      <div className="mt-1.5 truncate text-xl font-light tabular-nums leading-none text-text-primary">
        {value}
      </div>
    </div>
  );
}

/** Light-bg card. `bg-bg` is darker than the dock's `surface-1`, so
 *  the card reads as a tile on a sheet, not "white on white". */
function Card({
  title,
  actions,
  tone = "solid",
  children,
}: {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  tone?: "solid" | "dashed";
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl p-4",
        tone === "dashed"
          ? "border border-dashed border-line-soft bg-transparent"
          : "border border-line-soft bg-bg",
      )}
    >
      {(title || actions) && (
        <header className="mb-2 flex items-start justify-between gap-3">
          {title ? (
            <h3 className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
              {title}
            </h3>
          ) : (
            <span />
          )}
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

function SelectionPanel({ ctx }: { ctx: ViewProps["ctx"] }) {
  const focusedId = ctx.selection.focusedId;
  const entityOps = ctx.applicableOperations.filter(
    (r) => r.operation.scope.length > 0,
  );
  const handleClear = () => {
    ctx.setSelection({ ids: new Set<string>(), focusedId: null });
  };

  return (
    <Card
      tone="dashed"
      title="Selection"
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
      <div className="space-y-2">
        {focusedId ? (
          <code className="block truncate rounded bg-surface-2 px-1.5 py-1 font-mono text-[0.7rem] text-text-primary">
            {focusedId}
          </code>
        ) : (
          <p className="text-xs text-text-tertiary">
            Click anything on the map or in the list to see what you can do
            with it.
          </p>
        )}
        {entityOps.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {entityOps.map(({ operation, on }) => (
              <WorkbenchOperationButton
                key={operation.id}
                label={operation.label}
                icon={operation.icon}
                className="w-full justify-start"
                onClick={() =>
                  void ctx.runOperation(operation.id, undefined, on)
                }
              />
            ))}
          </div>
        ) : focusedId ? (
          <p className="text-xs text-text-tertiary">
            No actions available for this selection.
          </p>
        ) : null}
      </div>
    </Card>
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
