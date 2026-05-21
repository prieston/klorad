"use client";

import type { POI } from "@klorad/api";
import type { Entity, View, ViewProps } from "@klorad/config/workbench";
import { cn } from "@klorad/design-system";

/**
 * Phase 4b — TableView.
 *
 * A compact list of POIs in the left dock region. Click a row to
 * select; selection bridges to the map (the 3D view highlights the
 * same id). v1 is POI-only and renders as a single-column list
 * because the left dock is narrow for a real table.
 *
 * Per-entity-type column definitions (so the same component can
 * render Buildings, FloorPlans, etc. with their own columns) are
 * deferred. When TableView starts surfacing more than one entity
 * type, `EntityType` gains a `tableColumns: { key, label, render }`
 * field and this component renders against that.
 *
 * Style pass — typography matches OverviewView's header treatment;
 * row hover and selected states use the brand accent for the active
 * row, with a sharp 2px left rail so the eye locks onto it from a
 * peripheral glance.
 */
function TableViewComponent({ ctx }: ViewProps) {
  const pois = ctx.entities.byType("campus.poi") as Entity<POI>[];
  const selectedId = ctx.selection.focusedId;

  return (
    <div className="flex h-full flex-col">
      <header className="space-y-1 px-4 pb-3">
        <h2 className="text-base font-semibold text-text-primary">POIs</h2>
        <p className="text-[0.7rem] text-text-tertiary">
          {pois.length} {pois.length === 1 ? "entry" : "entries"}
        </p>
      </header>

      {pois.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6 py-12 text-center text-xs text-text-tertiary">
          No POIs in this world yet. Place one on the map to start.
        </div>
      ) : (
        <ul className="min-h-0 flex-1 overflow-auto px-2 pb-3">
          {pois.map((entity) => {
            const poi = entity.payload;
            const isSelected = entity.id === selectedId;
            const handleClick = () => {
              ctx.setSelection({
                ids: isSelected ? new Set<string>() : new Set([entity.id]),
                focusedId: isSelected ? null : entity.id,
              });
            };
            return (
              <li key={entity.id}>
                <button
                  type="button"
                  onClick={handleClick}
                  aria-pressed={isSelected}
                  className={cn(
                    "group flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left transition-colors",
                    "border-l-2",
                    isSelected
                      ? "border-l-accent bg-accent-soft text-text-primary"
                      : "border-l-transparent text-text-secondary hover:bg-surface-2 hover:text-text-primary",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {poi.name || "Unnamed POI"}
                  </span>
                  {poi.category ? (
                    <span
                      className={cn(
                        "shrink-0 rounded-full border border-line-soft px-1.5 py-0.5 text-[0.65rem] uppercase tracking-[0.04em] transition-colors",
                        isSelected
                          ? "bg-surface-1 text-text-secondary"
                          : "bg-surface-1 text-text-tertiary",
                      )}
                    >
                      {poi.category}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TableIcon({ className }: { className?: string }) {
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
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
    </svg>
  );
}

export const tableView: View = {
  id: "table",
  label: "Table",
  icon: TableIcon,
  entityTypes: ["campus.poi"],
  defaultDock: "left",
  component: TableViewComponent,
};
