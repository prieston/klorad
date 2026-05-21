"use client";

import { useMemo, useState } from "react";
import type { POI } from "@klorad/api";
import type { Entity, ViewContext } from "@klorad/config/workbench";
import { ContextMenu, WorkflowListButton, cn } from "@klorad/design-system";
import { EmptyHint, SearchPill } from "./shared";

/**
 * Workflow step 3 — flat, live-filtered list of POIs.
 *
 * Uses the DS `WorkflowListButton` (entire row is the click target;
 * no inner action buttons), so the row picks up the empty-bg +
 * grey-border + accent-on-select styling automatically.
 */
export function PoisStep({ ctx }: { ctx: ViewContext }) {
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
      const haystack = [poi.name, poi.category, poi.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [pois, query]);

  if (pois.length === 0) {
    return (
      <EmptyHint
        title="No POIs yet"
        body="Use ⌘K → “Place POI” to drop one on the map."
      />
    );
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <SearchPill value={query} onChange={setQuery} placeholder="Search POIs…" />
      {filtered.length === 0 ? (
        <p className="px-1 py-3 text-center text-xs text-text-tertiary">
          Nothing matches “{query}”.
        </p>
      ) : (
        <ul role="list" className="space-y-2">
          {filtered.map((entity) => {
            const poi = entity.payload;
            const isSelected = entity.id === selectedId;
            const isAccessible = !!poi.accessibility?.wheelchairAccessible;
            return (
              <li key={entity.id}>
                <WorkflowListButton
                  selected={isSelected}
                  onClick={() => {
                    ctx.setSelection({
                      ids: isSelected
                        ? new Set<string>()
                        : new Set([entity.id]),
                      focusedId: isSelected ? null : entity.id,
                    });
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setMenu({
                      x: e.clientX,
                      y: e.clientY,
                      entityId: entity.id,
                    });
                  }}
                >
                  <span
                    className={cn(
                      "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                      isSelected ? "bg-accent" : "bg-text-tertiary/40",
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium">
                    {poi.name || "Unnamed POI"}
                  </span>
                  {isAccessible ? (
                    <span
                      title="Accessible"
                      className={cn(
                        "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                        isSelected ? "bg-accent" : "bg-accent/60",
                      )}
                    />
                  ) : null}
                </WorkflowListButton>
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
