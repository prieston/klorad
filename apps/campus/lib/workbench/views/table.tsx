"use client";

import { useMemo, useState } from "react";
import type { POI, POICategory } from "@klorad/api";
import type { Entity, View, ViewProps } from "@klorad/config/workbench";
import { ContextMenu, cn } from "@klorad/design-system";

/**
 * Phase 4b → modernised — TableView.
 *
 * A live-filtered list of POIs in the left dock. The list is the
 * primary "what's in my world" surface, so it needs to read like a
 * proper list — searchable, scannable, with a clear sense of category.
 *
 * Each row carries:
 *   - a category-tinted dot (visual sort)
 *   - the POI's name (truncated if long)
 *   - a soft category label below
 *   - an accessibility chip on the right when applicable
 *
 * Selection: filled accent-soft bg + 2px accent left rail (the rail
 * is the peripheral signal that survives even at viewport scale).
 *
 * Per-entity-type column definitions land when TableView starts
 * surfacing more than one entity type — `EntityType` will gain a
 * `tableColumns: { key, label, render }` field.
 */
function TableViewComponent({ ctx }: ViewProps) {
  const pois = ctx.entities.byType("campus.poi") as Entity<POI>[];
  const selectedId = ctx.selection.focusedId;

  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    entityId: string;
  } | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pois;
    return pois.filter((e) => {
      const poi = e.payload;
      const haystack = [
        poi.name,
        poi.category,
        poi.description,
        ...(poi.tags ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [pois, query]);

  const accessibleCount = pois.filter(
    (e) => e.payload.accessibility?.wheelchairAccessible,
  ).length;

  return (
    <div className="flex h-full flex-col">
      <header className="space-y-2 px-4 pb-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-text-primary">
            Points of interest
          </h2>
          <span className="text-[0.7rem] tabular-nums text-text-tertiary">
            {pois.length} total
          </span>
        </div>
        <p className="text-[0.7rem] text-text-tertiary">
          {accessibleCount} accessible · {pois.length - accessibleCount} without
          info
        </p>
        <SearchInput value={query} onChange={setQuery} />
      </header>

      {pois.length === 0 ? (
        <EmptyState />
      ) : filtered.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6 py-8 text-center text-xs text-text-tertiary">
          Nothing matches “{query}”.
        </div>
      ) : (
        <ul className="min-h-0 flex-1 space-y-0.5 overflow-auto px-2 pb-3">
          {filtered.map((entity) => {
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
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setMenu({
                      x: e.clientX,
                      y: e.clientY,
                      entityId: entity.id,
                    });
                  }}
                  aria-pressed={isSelected}
                  className={cn(
                    "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all",
                    "border-l-2",
                    isSelected
                      ? "border-l-accent bg-accent-soft shadow-[inset_0_0_0_1px_var(--accent-soft)]"
                      : "border-l-transparent hover:bg-surface-2",
                  )}
                >
                  <CategoryDot
                    category={poi.category}
                    selected={isSelected}
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span
                      className={cn(
                        "truncate text-sm font-medium transition-colors",
                        isSelected ? "text-text-primary" : "text-text-primary",
                      )}
                    >
                      {poi.name || "Unnamed POI"}
                    </span>
                    {poi.category || poi.description ? (
                      <span className="truncate text-[0.7rem] text-text-tertiary">
                        {[poi.category, poi.description]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    ) : null}
                  </div>
                  {poi.accessibility?.wheelchairAccessible ? (
                    <WheelchairBadge />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}

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

/** Small live search input — matches the dashboard's input style. */
function SearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-line-soft bg-surface-1 px-2.5 py-1.5 focus-within:border-accent">
      <SearchIcon className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search…"
        className="w-full bg-transparent text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="text-text-tertiary transition-colors hover:text-text-primary"
        >
          <ClearIcon className="h-3 w-3" />
        </button>
      ) : null}
    </label>
  );
}

/**
 * Category dot — a small ring with a tinted fill. Same shape across
 * all categories so the eye scans by *position* + *colour intensity*
 * rather than by glyph. Keeps the row uncluttered.
 */
function CategoryDot({
  category,
  selected,
}: {
  category?: POICategory;
  selected?: boolean;
}) {
  // Single dot, tint stronger when the row is selected. Keeps the
  // palette small — the brand accent does the heavy lifting. Future
  // upgrade: per-category hue.
  return (
    <span
      aria-hidden
      className={cn(
        "relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors",
        selected
          ? "border-accent bg-accent text-accent-contrast"
          : "border-line-soft bg-surface-1 text-text-tertiary group-hover:border-accent group-hover:text-accent",
      )}
    >
      <CategoryGlyph category={category} className="h-3.5 w-3.5" />
    </span>
  );
}

/**
 * Tiny per-category glyph. Generic POI pin for everything that
 * doesn't have a specific shape — keeps the row visual weight
 * consistent across categories.
 */
function CategoryGlyph({
  category,
  className,
}: {
  category?: POICategory;
  className?: string;
}) {
  if (category === "building") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden
      >
        <rect x="4" y="3" width="16" height="18" rx="1" />
        <line x1="9" y1="8" x2="9" y2="8" />
        <line x1="15" y1="8" x2="15" y2="8" />
        <line x1="9" y1="13" x2="9" y2="13" />
        <line x1="15" y1="13" x2="15" y2="13" />
      </svg>
    );
  }
  if (category === "dining") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden
      >
        <path d="M18 8h1a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-1" />
        <path d="M3 21V8a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v13Z" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 21s-7-6.5-7-12a7 7 0 1 1 14 0c0 5.5-7 12-7 12Z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

/** Right-side chip when the POI carries an accessibility flag. */
function WheelchairBadge() {
  return (
    <span
      title="Wheelchair accessible"
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3 w-3"
        aria-hidden
      >
        <circle cx="12" cy="4" r="2" />
        <path d="M19 13v-2a8 8 0 0 0-8-8" opacity={0.4} />
        <path d="M9 6 8 10l4 2 1 5 4 1" />
        <circle cx="11" cy="17" r="5" />
      </svg>
    </span>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-line-soft text-text-tertiary">
        <CategoryGlyph className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-text-primary">No POIs yet</p>
        <p className="text-[0.7rem] text-text-tertiary">
          Run <kbd className="rounded bg-surface-2 px-1 font-mono">⌘K</kbd> →
          “Place POI” to drop one.
        </p>
      </div>
    </div>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function ClearIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
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
