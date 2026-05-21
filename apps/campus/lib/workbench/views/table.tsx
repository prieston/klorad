"use client";

import { useMemo, useState } from "react";
import type { POI } from "@klorad/api";
import type { Entity, View, ViewProps } from "@klorad/config/workbench";
import { ContextMenu, cn } from "@klorad/design-system";

/**
 * Phase 4b → modern lite — TableView.
 *
 * The "outdated" feedback was right: too many boxes, grey rows, a
 * rectangular input. The dashboard / website use lighter patterns —
 * glass pill inputs, count chips, hover-only highlights, no visible
 * borders on row containers. This pass matches that aesthetic.
 *
 * Rows are text-first. A tiny accent dot marks the current
 * selection; otherwise no chrome. Hover lifts a soft bg. Selected
 * rows take a full accent-soft fill with accent text — the same
 * peripheral signal pill-shaped CTAs use elsewhere.
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

  return (
    <div className="flex h-full flex-col">
      <header className="space-y-3 px-4 pt-1 pb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold tracking-tight text-text-primary">
            POIs
          </h2>
          {pois.length > 0 ? (
            <span className="inline-flex items-center rounded-full bg-accent-soft px-2 py-0.5 text-[0.7rem] font-semibold tabular-nums text-accent">
              {pois.length}
            </span>
          ) : null}
        </div>
        {pois.length > 0 ? (
          <SearchPill value={query} onChange={setQuery} />
        ) : null}
      </header>

      {pois.length === 0 ? (
        <EmptyState />
      ) : filtered.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6 py-8 text-center text-xs text-text-tertiary">
          Nothing matches “{query}”.
        </div>
      ) : (
        <ul className="min-h-0 flex-1 space-y-px overflow-auto px-2 pb-3">
          {filtered.map((entity) => {
            const poi = entity.payload;
            const isSelected = entity.id === selectedId;
            const isAccessible = !!poi.accessibility?.wheelchairAccessible;
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
                    "group flex w-full items-center gap-2.5 rounded-full px-3 py-1.5 text-left transition-colors",
                    isSelected
                      ? "bg-accent-soft text-accent"
                      : "text-text-secondary hover:bg-surface-2 hover:text-text-primary",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "inline-block h-1.5 w-1.5 shrink-0 rounded-full transition-colors",
                      isSelected
                        ? "bg-accent"
                        : "bg-text-tertiary/40 group-hover:bg-text-tertiary",
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium">
                    {poi.name || "Unnamed POI"}
                  </span>
                  {poi.category ? (
                    <span
                      className={cn(
                        "shrink-0 text-[0.65rem] uppercase tracking-[0.06em] transition-colors",
                        isSelected
                          ? "text-accent/70"
                          : "text-text-tertiary",
                      )}
                    >
                      {poi.category}
                    </span>
                  ) : null}
                  {isAccessible ? (
                    <span
                      aria-label="Wheelchair accessible"
                      title="Wheelchair accessible"
                      className={cn(
                        "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                        isSelected ? "bg-accent" : "bg-accent/70",
                      )}
                    />
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

/**
 * Glass pill search — same shape as the chips the website / dashboard
 * use. No heavy border, no grey rectangle.
 */
function SearchPill({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="glass-panel flex items-center gap-2 rounded-full px-3 py-1.5 transition-colors focus-within:border-accent">
      <SearchIcon className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search…"
        className="w-full bg-transparent text-[0.8125rem] text-text-primary placeholder:text-text-tertiary focus:outline-none"
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

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
        <PoiIcon className="h-4 w-4" />
      </span>
      <p className="text-[0.8125rem] font-medium text-text-primary">
        No POIs yet
      </p>
      <p className="text-[0.7rem] text-text-tertiary">
        Press{" "}
        <kbd className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[0.65rem] text-text-secondary">
          ⌘K
        </kbd>{" "}
        and pick “Place POI”.
      </p>
    </div>
  );
}

function PoiIcon({ className }: { className?: string }) {
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
