"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Locate, MapPin, Search, X } from "lucide-react";

/** Special id for the "Your location" option — surfaced to the
 *  parent so it can swap in a GPS-derived space id. */
export const YOUR_LOCATION_ID = "__your_location__";

export interface PickerOption {
  /** Space id, or `YOUR_LOCATION_ID` for the GPS-driven entry. */
  id: string;
  /** Display name. */
  name: string;
  /** Optional sub-label (e.g. building name) shown under the row. */
  subtitle?: string;
}

interface Props {
  /** Top label (e.g. "FROM" / "TO"). */
  label: string;
  /** Icon component placed on the left of the trigger row. */
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
  /** Current selection — `value === YOUR_LOCATION_ID` triggers the
   *  "Your location" affordance. */
  value: string;
  /** Display string shown in the trigger row + as the placeholder
   *  in the picker. */
  valueLabel: string;
  /** Full option list — the picker filters this against the search
   *  query. */
  options: PickerOption[];
  /** Show the "Your location" option at the top of the list. */
  showYourLocation?: boolean;
  /** EN/EL strings. */
  locale: "en" | "el";
  /** Tap an option — caller switches the selection. */
  onSelect: (id: string) => void;
}

const COPY = {
  en: {
    search: "Search…",
    yourLocation: "Your location",
    yourLocationHint: "Tap to enable location",
    close: "Close",
  },
  el: {
    search: "Αναζήτηση…",
    yourLocation: "Η τοποθεσία σου",
    yourLocationHint: "Πατήστε για ενεργοποίηση",
    close: "Κλείσιμο",
  },
} as const;

/**
 * Searchable dropdown for a route endpoint. The trigger row sits
 * inline with the route header; tapping it opens an overlay panel
 * with a search input + the option list. Top option is the
 * "Your location" GPS affordance when `showYourLocation` is on.
 *
 * Open state is local — the parent only sees option selections.
 * Closes on Escape, backdrop tap, and option select.
 */
export function RouteEndpointPicker({
  label,
  icon: Icon,
  value,
  valueLabel,
  options,
  showYourLocation = false,
  locale,
  onSelect,
}: Props) {
  const copy = COPY[locale];
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the input when the picker opens so a visitor can start
  // typing immediately.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? options.filter((o) => o.name.toLowerCase().includes(q))
      : options;
  }, [options, query]);

  const handleSelect = (id: string) => {
    setOpen(false);
    setQuery("");
    onSelect(id);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--brand-primary-bg)]"
        style={{ background: "none" }}
      >
        <span
          aria-hidden
          className="flex h-5 w-5 shrink-0 items-center justify-center"
        >
          <Icon size={16} strokeWidth={2} color="var(--brand-primary)" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--brand-text-muted)]">
            {label}
          </span>
          <span className="block truncate text-sm font-semibold text-[var(--brand-text)]">
            {valueLabel}
          </span>
        </span>
        <ChevronDown
          aria-hidden
          size={16}
          strokeWidth={2}
          className="shrink-0 text-[var(--brand-text-muted)]"
        />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center px-3 pb-3 md:items-center md:pb-0">
          <button
            type="button"
            aria-label={copy.close}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="relative flex max-h-[80dvh] w-full max-w-[520px] flex-col overflow-hidden rounded-3xl bg-white shadow-xl">
            <div className="px-4 pb-3 pt-4">
              <div className="flex items-center gap-2 rounded-2xl bg-[var(--brand-page)] px-3.5 py-2.5">
                <Search
                  size={16}
                  strokeWidth={2}
                  className="shrink-0 text-[var(--brand-text-muted)]"
                  aria-hidden
                />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={copy.search}
                  className="min-w-0 flex-1 bg-transparent text-sm text-[var(--brand-text)] outline-none placeholder:text-[var(--brand-text-muted)]"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Clear"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[var(--brand-text-muted)] hover:text-[var(--brand-text)]"
                  >
                    <X size={14} strokeWidth={2} />
                  </button>
                ) : null}
              </div>
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto py-2">
              {showYourLocation && !query ? (
                <li>
                  <button
                    type="button"
                    onClick={() => handleSelect(YOUR_LOCATION_ID)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--brand-primary-bg)]"
                    style={{ background: "none" }}
                  >
                    <span
                      aria-hidden
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{
                        backgroundColor:
                          "color-mix(in srgb, var(--brand-primary) 14%, #ffffff)",
                        color: "var(--brand-primary)",
                      }}
                    >
                      <Locate size={16} strokeWidth={2} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-[var(--brand-text)]">
                        {copy.yourLocation}
                      </span>
                      <span className="block truncate text-xs text-[var(--brand-text-muted)]">
                        {copy.yourLocationHint}
                      </span>
                    </span>
                  </button>
                </li>
              ) : null}
              {filtered.map((o) => {
                const active = o.id === value;
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(o.id)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--brand-primary-bg)]"
                      style={{
                        background: active
                          ? "color-mix(in srgb, var(--brand-primary) 5%, #ffffff)"
                          : "none",
                      }}
                    >
                      <span
                        aria-hidden
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                        style={{
                          backgroundColor:
                            "color-mix(in srgb, var(--brand-primary) 14%, #ffffff)",
                          color: "var(--brand-primary)",
                        }}
                      >
                        <MapPin size={16} strokeWidth={1.75} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[var(--brand-text)]">
                          {o.name}
                        </span>
                        {o.subtitle ? (
                          <span className="block truncate text-xs text-[var(--brand-text-muted)]">
                            {o.subtitle}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
