"use client";

import { cn } from "@klorad/design-system";

/**
 * Friendly per-step empty state — used by Buildings (when no
 * buildings), POIs (when no POIs), Floor detail (no rooms), etc.
 * Looks the same across all of them so the panel reads as one
 * coherent product.
 */
export function EmptyHint({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-line-soft p-5 text-center">
      <p className="text-[0.8125rem] font-medium text-text-primary">{title}</p>
      <p className="mt-1 text-[0.7rem] text-text-tertiary">{body}</p>
    </div>
  );
}

/**
 * Search input used in workflow step content (POIs today; future
 * steps can reuse). Light grey rounded box, no border, no focus
 * ring — same family as the AI Assistant prompt cards.
 */
export function SearchPill({
  value,
  onChange,
  placeholder = "Search…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex items-center gap-2.5 rounded-2xl bg-surface-2 p-4">
      <SearchIcon className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-xs text-text-primary placeholder:text-text-tertiary"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className={cn(
            "text-text-tertiary transition-colors hover:text-text-primary",
          )}
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
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      ) : null}
    </label>
  );
}

/**
 * The leading marker shared by every workflow list row — buildings,
 * floors' rooms, POIs. A small grey dot that brightens on row hover.
 * Hidden on the selected row (the accent fill already marks it), but
 * the element is kept as an invisible spacer so row text stays
 * aligned with its neighbours. One place keeps the lists a family.
 */
export function RowDot({ selected }: { selected?: boolean }) {
  return (
    <span
      className={cn(
        "inline-block h-1.5 w-1.5 shrink-0 rounded-full transition-colors",
        selected
          ? "bg-transparent"
          : "bg-text-tertiary/40 group-hover:bg-text-tertiary/70",
      )}
    />
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
