"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import * as Popover from "@radix-ui/react-popover";
import { cn } from "@klorad/design-system";

export interface SearchableOption {
  id: string;
  name: string;
}

export interface SearchableSelectProps {
  options: SearchableOption[];
  value: string;
  onChange: (id: string) => void;
  /** Text in the closed trigger when nothing is selected. */
  placeholder?: string;
  /** Placeholder inside the popup's search input. */
  searchPlaceholder?: string;
  noMatchLabel?: string;
  /** Footer when the filtered list is capped. */
  moreResultsLabel?: (shown: number, total: number) => string;
  /** Optional `aria-label` for the trigger. */
  ariaLabel?: string;
}

const MAX_RESULTS = 50;

/**
 * Searchable select built on Radix Popover.
 *
 * Closed: a button-like trigger shows the selected option's name
 *   (or a placeholder) + a caret.
 * Open : a popover anchored off the trigger holds a search input
 *   on top + a scrollable list of matches below.
 *
 * Radix owns the hard parts — portal to body, viewport collision
 * (auto-flips up when there's no room below), focus + outside-click
 * + escape, and the `--radix-popover-content-available-height` CSS
 * var that caps the popover to whatever room the viewport has left,
 * so the inner list scrolls inside the popup even on a phone. The
 * width matches the trigger via `--radix-popover-trigger-width`.
 *
 * Results are capped at 50 with a "refine to see more" footer so a
 * 400-room venue doesn't push 400 buttons through the DOM the
 * moment the popover opens.
 */
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  noMatchLabel,
  moreResultsLabel,
  ariaLabel,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [focusIndex, setFocusIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(
    () => options.find((o) => o.id === value),
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, query]);

  const visible = filtered.slice(0, MAX_RESULTS);
  const truncated = filtered.length > MAX_RESULTS;

  const choose = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery("");
  };

  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIndex((i) => Math.min(i + 1, visible.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = visible[focusIndex];
      if (opt) choose(opt.id);
    }
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
        if (o) setFocusIndex(0);
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-lg border border-solid border-line-soft bg-surface-1 px-3 py-2 text-left text-sm outline-none transition-colors hover:border-accent focus:border-accent",
            selectedOption ? "text-text-primary" : "text-text-tertiary",
          )}
        >
          <span className="truncate">
            {selectedOption?.name ?? placeholder ?? "Select…"}
          </span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className={cn(
              "shrink-0 text-text-tertiary transition-transform",
              open && "rotate-180",
            )}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          collisionPadding={8}
          style={{
            width: "var(--radix-popover-trigger-width)",
            maxHeight: "var(--radix-popover-content-available-height)",
          }}
          className="z-50 flex flex-col overflow-hidden rounded-2xl border border-solid border-line-soft bg-surface-1 shadow-glass"
          // We focus the search input ourselves; otherwise Radix
          // would focus the Content wrapper.
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            searchRef.current?.focus();
          }}
        >
          <div className="p-4 pb-2">
            <input
              ref={searchRef}
              type="text"
              value={query}
              placeholder={searchPlaceholder ?? "Search…"}
              onChange={(e) => {
                setQuery(e.target.value);
                setFocusIndex(0);
              }}
              onKeyDown={onSearchKey}
              className="w-full rounded-lg border border-solid border-line-soft bg-surface-1 px-3 py-2 text-sm text-text-primary outline-none transition-colors placeholder:text-text-tertiary focus:border-accent"
            />
          </div>
          {/*
            div / div (not ul / li) on purpose — apps/campus has
            Tailwind preflight off, so <ul> default bullets +
            <button> default borders render through. The list
            container + per-option `border: none` inline style
            keep this clean without depending on a global reset.
          */}
          <div
            role="listbox"
            className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-4 pt-2"
          >
            {visible.length === 0 ? (
              <div className="px-3 py-2 text-xs text-text-tertiary">
                {noMatchLabel ?? "No matches"}
              </div>
            ) : (
              visible.map((o, i) => (
                <button
                  key={o.id}
                  type="button"
                  role="option"
                  aria-selected={o.id === value}
                  onMouseDown={(e) => {
                    // mousedown fires before any pending blur — so
                    // the click registers before Radix's outside-
                    // click logic closes the popover.
                    e.preventDefault();
                    choose(o.id);
                  }}
                  onMouseEnter={() => setFocusIndex(i)}
                  style={{ border: "none" }}
                  className={cn(
                    "block w-full cursor-pointer rounded-lg bg-transparent px-3 py-2 text-left text-sm transition-colors",
                    o.id === value
                      ? "bg-accent-soft text-accent"
                      : i === focusIndex
                        ? "bg-surface-2 text-text-primary"
                        : "text-text-primary hover:bg-surface-2",
                  )}
                >
                  {o.name}
                </button>
              ))
            )}
            {truncated ? (
              <div className="mt-1 px-3 py-1 text-[0.7rem] italic text-text-tertiary">
                {moreResultsLabel
                  ? moreResultsLabel(MAX_RESULTS, filtered.length)
                  : `Showing ${MAX_RESULTS} of ${filtered.length}`}
              </div>
            ) : null}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
