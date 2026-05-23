"use client";

import { useMemo, useState } from "react";
import { cn } from "@klorad/design-system";
import { translate, type Locale } from "@/app/lib/i18n-core";
import type { SpaceOption } from "./WayfindingControls";

/** Display labels for common MappedIn space types; falls back to titlecase. */
const PRETTY_TYPE: Record<string, string> = {
  wc: "WC",
  cafe: "Café",
};

function prettyType(t: string): string {
  if (PRETTY_TYPE[t]) return PRETTY_TYPE[t];
  return t
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface SearchControlsProps {
  /** Named spaces in the venue, searched by name. */
  spaces: SpaceOption[];
  /** Fired when a result is picked — the viewer flies there. */
  onSelect: (spaceId: string) => void;
  /** UI locale — defaults to English. */
  locale?: Locale;
}

const MAX_RESULTS = 8;

/**
 * Indoor search — a floating box over the MappedIn viewer. Type a
 * room or space name, pick a result, and the viewer switches to its
 * floor and flies the camera to it. Presentational: it only filters
 * the space list and emits `onSelect`.
 */
export function SearchControls({
  spaces,
  onSelect,
  locale = "en",
}: SearchControlsProps) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const q = query.trim().toLowerCase();

  // Categories — derived from the venue's space types, sorted by
  // count so the most useful chips lead. Hidden when no space carries
  // a type.
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of spaces) {
      if (!s.type) continue;
      counts.set(s.type, (counts.get(s.type) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count, label: prettyType(type) }));
  }, [spaces]);

  const matches = useMemo(() => {
    let pool = spaces;
    if (activeCategory) pool = pool.filter((s) => s.type === activeCategory);
    if (q) pool = pool.filter((s) => s.name.toLowerCase().includes(q));
    return pool.slice(0, MAX_RESULTS);
  }, [spaces, activeCategory, q]);

  const showResults = q !== "" || activeCategory !== null;

  return (
    <div className="space-y-2 rounded-2xl border border-line-soft bg-surface-1/95 p-3 shadow-glass backdrop-blur">
      {categories.length > 0 ? (
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          {categories.map((cat) => {
            const active = activeCategory === cat.type;
            return (
              <button
                key={cat.type}
                type="button"
                onClick={() =>
                  setActiveCategory(active ? null : cat.type)
                }
                aria-pressed={active}
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                  active
                    ? "bg-accent text-accent-contrast"
                    : "bg-surface-2 text-text-secondary hover:bg-accent-soft hover:text-accent",
                )}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <SearchIcon className="h-4 w-4 shrink-0 text-text-tertiary" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={translate(locale, "mappedin.searchPlaceholder")}
          className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-tertiary"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label={translate(locale, "mappedin.searchClear")}
            className="shrink-0 text-text-tertiary transition-colors hover:text-text-primary"
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {showResults && matches.length > 0 ? (
        <ul className="max-h-56 space-y-0.5 overflow-y-auto">
          {matches.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(s.id);
                  setQuery("");
                  setActiveCategory(null);
                }}
                className="block w-full truncate rounded-lg px-2 py-1.5 text-left text-sm text-text-secondary transition-colors hover:bg-accent-soft hover:text-accent"
              >
                {s.name}
              </button>
            </li>
          ))}
        </ul>
      ) : showResults && q ? (
        <p className="px-2 text-xs text-text-tertiary">
          {translate(locale, "mappedin.searchNoMatch", { query })}
        </p>
      ) : null}
    </div>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
