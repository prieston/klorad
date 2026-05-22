"use client";

import { useState } from "react";
import type { SpaceOption } from "./WayfindingControls";

export interface SearchControlsProps {
  /** Named spaces in the venue, searched by name. */
  spaces: SpaceOption[];
  /** Fired when a result is picked — the viewer flies there. */
  onSelect: (spaceId: string) => void;
}

const MAX_RESULTS = 8;

/**
 * Indoor search — a floating box over the MappedIn viewer. Type a
 * room or space name, pick a result, and the viewer switches to its
 * floor and flies the camera to it. Presentational: it only filters
 * the space list and emits `onSelect`.
 */
export function SearchControls({ spaces, onSelect }: SearchControlsProps) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const matches = q
    ? spaces.filter((s) => s.name.toLowerCase().includes(q)).slice(0, MAX_RESULTS)
    : [];

  return (
    <div className="rounded-2xl border border-line-soft bg-surface-1/95 p-3 shadow-glass backdrop-blur">
      <div className="flex items-center gap-2">
        <SearchIcon className="h-4 w-4 shrink-0 text-text-tertiary" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a room or space…"
          className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-tertiary"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="shrink-0 text-text-tertiary transition-colors hover:text-text-primary"
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {q && matches.length > 0 ? (
        <ul className="mt-2 max-h-56 space-y-0.5 overflow-y-auto">
          {matches.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(s.id);
                  setQuery("");
                }}
                className="block w-full truncate rounded-lg px-2 py-1.5 text-left text-sm text-text-secondary transition-colors hover:bg-accent-soft hover:text-accent"
              >
                {s.name}
              </button>
            </li>
          ))}
        </ul>
      ) : q ? (
        <p className="mt-2 px-2 text-xs text-text-tertiary">
          Nothing matches “{query}”.
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
