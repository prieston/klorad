"use client";

import { ChevronRight } from "lucide-react";

export interface BuildingsListItem {
  id: string;
  name: string;
}

interface Props {
  items: BuildingsListItem[];
  selectedId?: string;
  /** Tap the row body — used to zoom the map to that building. */
  onSelect: (id: string) => void;
  /** Tap the chevron — opens the building's detail sheet (rooms + actions). */
  onOpenDetail?: (id: string) => void;
  /** Filter the visible rows by name (case-insensitive). */
  query?: string;
  /** EN/EL strings. */
  locale: "en" | "el";
}

const COPY = {
  en: {
    heading: "Buildings",
    empty: "No buildings yet.",
    noMatch: "No buildings match that search.",
  },
  el: {
    heading: "Κτίρια",
    empty: "Δεν υπάρχουν κτίρια.",
    noMatch: "Κανένα κτίριο δεν ταιριάζει.",
  },
} as const;

function buildingInitials(name: string): string {
  const parts = name
    .replace(/[^A-Za-z\s]/g, "")
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean);
  if (parts.length === 0) return "•";
  return parts.slice(0, 3).join("").toUpperCase();
}

/**
 * Up-front buildings list — rendered below the map on the consumer
 * map page. Each row has TWO tap targets:
 *
 *   - The row body → `onSelect`, which zooms the map to that
 *     building (same behaviour as the legacy dropdown).
 *   - The chevron on the right → `onOpenDetail`, which opens a
 *     bottom sheet with the building's rooms list + actions.
 *
 * The optional `query` filters rows by case-insensitive substring
 * match on name. The heading shows the visible count.
 */
export function BuildingsList({
  items,
  selectedId,
  onSelect,
  onOpenDetail,
  query,
  locale,
}: Props) {
  const copy = COPY[locale];
  const q = (query ?? "").trim().toLowerCase();
  const filtered = q
    ? items.filter((b) => b.name.toLowerCase().includes(q))
    : items;
  return (
    <section className="mx-auto max-w-[760px] px-4 pt-4 md:px-6">
      <div className="flex items-baseline justify-between pb-3">
        <h2 className="text-base font-semibold text-[var(--brand-text)]">
          {copy.heading}
        </h2>
        <span className="text-xs text-[var(--brand-text-muted)]">
          {filtered.length}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="rounded-2xl bg-white p-4 text-sm text-[var(--brand-text-muted)]">
          {copy.empty}
        </p>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl bg-white p-4 text-sm text-[var(--brand-text-muted)]">
          {copy.noMatch}
        </p>
      ) : (
        <ul className="flex flex-col gap-2 pb-4">
          {filtered.map((b) => {
            const active = b.id === selectedId;
            const initials = buildingInitials(b.name);
            return (
              <li key={b.id}>
                <div
                  className="flex w-full items-center gap-3 rounded-2xl border border-solid px-3 py-2.5"
                  style={
                    active
                      ? {
                          backgroundColor:
                            "color-mix(in srgb, var(--brand-primary) 7%, #ffffff)",
                          borderColor: "var(--brand-primary)",
                        }
                      : {
                          backgroundColor:
                            "color-mix(in srgb, var(--brand-primary) 3%, #ffffff)",
                          borderColor: "transparent",
                        }
                  }
                >
                  <button
                    type="button"
                    onClick={() => onSelect(b.id)}
                    aria-current={active ? "true" : undefined}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    style={{ background: "none" }}
                  >
                    <span
                      aria-hidden
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[10px] font-bold tracking-wide"
                      style={{
                        backgroundColor:
                          "color-mix(in srgb, var(--brand-primary) 14%, #ffffff)",
                        color: "var(--brand-primary)",
                      }}
                    >
                      {initials}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--brand-text)]">
                      {b.name}
                    </span>
                  </button>
                  {onOpenDetail ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenDetail(b.id);
                      }}
                      aria-label={`Open ${b.name} details`}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-opacity hover:opacity-80"
                      style={{
                        backgroundColor:
                          "color-mix(in srgb, var(--brand-primary) 14%, #ffffff)",
                        color: "var(--brand-primary)",
                      }}
                    >
                      <ChevronRight size={18} strokeWidth={1.75} />
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
