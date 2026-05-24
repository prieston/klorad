"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@klorad/design-system";

export interface SearchableOption {
  id: string;
  name: string;
}

export interface SearchableSelectProps {
  options: SearchableOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  noMatchLabel?: string;
  /** Optional `aria-label` — useful when no visible label sits above. */
  ariaLabel?: string;
}

/**
 * A small searchable combobox — type to filter, click to pick.
 *
 * Native `<select>` is unusable once a venue has hundreds of spaces;
 * the user scrolls through 200 options to find "Lecture Hall 3."
 * This input filters as the user types, keeps keyboard nav, and
 * stays inside the campus's existing surface / accent tokens so it
 * matches the rest of the panel without pulling in a dependency.
 *
 * The dropdown is rendered through a portal on `document.body` with
 * `position: fixed`, so it escapes the side panel's
 * `overflow-y-auto` clipping and outranks any sibling's stacking.
 * Position is the input's `getBoundingClientRect()`, recomputed on
 * scroll + resize so the menu tracks the input.
 */
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  noMatchLabel,
  ariaLabel,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [focusIndex, setFocusIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // SSR-safe portal — only render once the client has mounted.
  useEffect(() => {
    setMounted(true);
  }, []);

  const selectedOption = useMemo(
    () => options.find((o) => o.id === value),
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, query]);

  // When the dropdown is open, the input shows the live query;
  // when closed, it shows the selected name (or empty placeholder).
  const displayValue = open ? query : (selectedOption?.name ?? "");

  // Track the input's screen rect while the dropdown is open so the
  // portaled menu stays glued to it during scroll / resize.
  useEffect(() => {
    if (!open) return;
    const el = inputRef.current;
    if (!el) return;
    const update = () => setRect(el.getBoundingClientRect());
    update();
    window.addEventListener("resize", update);
    // Capture phase catches scroll inside any ancestor (the side
    // panel's overflow-y-auto in particular).
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  // Close when the user clicks anywhere outside both the input
  // wrapper and the portaled list (which lives on document.body).
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current?.contains(target) ||
        listRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
      setQuery("");
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const choose = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setFocusIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[focusIndex];
      if (opt) choose(opt.id);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
      inputRef.current?.blur();
    }
  };

  const dropdown =
    open && rect ? (
      <ul
        ref={listRef}
        role="listbox"
        style={{
          position: "fixed",
          top: rect.bottom + 4,
          left: rect.left,
          width: rect.width,
        }}
        className="z-[60] max-h-64 overflow-y-auto rounded-lg border border-solid border-line-soft bg-surface-1 py-1 shadow-glass"
      >
        {filtered.length === 0 ? (
          <li className="px-3 py-2 text-xs text-text-tertiary">
            {noMatchLabel ?? "No matches"}
          </li>
        ) : (
          filtered.map((o, i) => (
            <li key={o.id}>
              <button
                type="button"
                role="option"
                aria-selected={o.id === value}
                // mousedown fires before input blur — so the click
                // registers before the outside-click effect closes
                // the dropdown.
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(o.id);
                }}
                onMouseEnter={() => setFocusIndex(i)}
                className={cn(
                  "w-full px-3 py-2 text-left text-sm transition-colors",
                  o.id === value
                    ? "bg-accent-soft text-accent"
                    : i === focusIndex
                      ? "bg-surface-2 text-text-primary"
                      : "text-text-primary hover:bg-surface-2",
                )}
              >
                {o.name}
              </button>
            </li>
          ))
        )}
      </ul>
    ) : null;

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-label={ariaLabel}
        value={displayValue}
        placeholder={placeholder}
        onFocus={() => {
          setOpen(true);
          setQuery("");
          setFocusIndex(0);
        }}
        onChange={(e) => {
          setOpen(true);
          setQuery(e.target.value);
          setFocusIndex(0);
        }}
        onKeyDown={onKeyDown}
        className="w-full rounded-md border border-solid border-line-soft bg-surface-1 px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent"
      />
      {mounted && dropdown ? createPortal(dropdown, document.body) : null}
    </div>
  );
}
