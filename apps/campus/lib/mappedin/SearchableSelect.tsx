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
  /** Text in the closed trigger when nothing is selected. */
  placeholder?: string;
  /** Placeholder inside the popup's search input. */
  searchPlaceholder?: string;
  noMatchLabel?: string;
  /**
   * Footer shown when the filtered list is capped. Receives the
   * shown / total counts so it can render its own message.
   */
  moreResultsLabel?: (shown: number, total: number) => string;
  /** Optional `aria-label` for the trigger. */
  ariaLabel?: string;
}

/**
 * Anchor geometry for the floating popover. Stored in state so the
 * popover positions itself relative to the trigger's actual screen
 * box — viewport-aware so it always fits, scrolls when it can't.
 */
interface PopoverGeom {
  left: number;
  width: number;
  maxHeight: number;
  openUp: boolean;
  /** If `openUp`, distance from viewport bottom; else from viewport top. */
  vOffset: number;
}

/**
 * Trim the list before render so the popover stays bounded even
 * when nobody has typed yet — a venue with 400 rooms shouldn't
 * pour 400 buttons into the DOM. A footer prompts the user to
 * type once the cap kicks in.
 */
const MAX_RESULTS = 50;
const MIN_POPUP_HEIGHT = 200;
const VIEWPORT_MARGIN = 8;

/**
 * Searchable select with a "search-in-popup" pattern.
 *
 * Closed: a button-like trigger shows the selected option's name
 *   (or a placeholder) + a caret.
 * Open : a popover floats off the trigger holding a search input
 *   and a scrollable list of matches; capped at 50 with a footer
 *   when more exist so the user knows to refine.
 *
 * The popover is portaled to `document.body` with `position: fixed`
 * so the side panel's `overflow-y-auto` can't clip it and no sibling
 * outranks its stacking. `maxHeight` = the actual room left in the
 * viewport (above or below, whichever is larger), so on a phone
 * screen the inner list scrolls instead of overflowing the page.
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
  const [geom, setGeom] = useState<PopoverGeom | null>(null);
  const [mounted, setMounted] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

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

  const visible = filtered.slice(0, MAX_RESULTS);
  const truncated = filtered.length > MAX_RESULTS;

  /** Read the trigger's screen rect and choose up/down + max height. */
  const recompute = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const below = viewportH - r.bottom - VIEWPORT_MARGIN;
    const above = r.top - VIEWPORT_MARGIN;
    const openUp = below < MIN_POPUP_HEIGHT && above > below;
    setGeom({
      left: r.left,
      width: r.width,
      maxHeight: Math.max(MIN_POPUP_HEIGHT, openUp ? above : below),
      openUp,
      vOffset: openUp ? viewportH - r.top + 4 : r.bottom + 4,
    });
  };

  // Re-anchor on scroll / resize while open so the popover tracks
  // the trigger when the side panel scrolls or the window changes.
  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", recompute);
    window.addEventListener("scroll", recompute, true);
    return () => {
      window.removeEventListener("resize", recompute);
      window.removeEventListener("scroll", recompute, true);
    };
  }, [open]);

  // Autofocus the search input once the popover paints.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => searchRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  // Close on outside-click (neither the trigger nor the popover).
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        triggerRef.current?.contains(t) ||
        popoverRef.current?.contains(t)
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
  };

  const toggleOpen = () => {
    if (open) {
      setOpen(false);
      setQuery("");
    } else {
      // Compute geometry synchronously so the popover paints in the
      // right place on its first render — no first-frame flicker.
      recompute();
      setQuery("");
      setFocusIndex(0);
      setOpen(true);
    }
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
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  };

  const popover =
    open && geom ? (
      <div
        ref={popoverRef}
        style={{
          position: "fixed",
          left: geom.left,
          width: geom.width,
          maxHeight: geom.maxHeight,
          ...(geom.openUp
            ? { bottom: geom.vOffset }
            : { top: geom.vOffset }),
        }}
        className="z-[60] flex flex-col overflow-hidden rounded-lg border border-solid border-line-soft bg-surface-1 shadow-glass"
      >
        <div className="border-b border-solid border-line-soft p-2">
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
            className="w-full rounded-md border border-solid border-line-soft bg-surface-1 px-2 py-1.5 text-sm text-text-primary outline-none transition-colors focus:border-accent"
          />
        </div>
        <ul role="listbox" className="min-h-0 flex-1 overflow-y-auto py-1">
          {visible.length === 0 ? (
            <li className="px-3 py-2 text-xs text-text-tertiary">
              {noMatchLabel ?? "No matches"}
            </li>
          ) : (
            visible.map((o, i) => (
              <li key={o.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o.id === value}
                  // mousedown fires before any pending blur — the
                  // click registers before the outside-click effect
                  // tries to close the popover.
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
          {truncated ? (
            <li className="border-t border-solid border-line-soft px-3 py-2 text-[0.7rem] italic text-text-tertiary">
              {moreResultsLabel
                ? moreResultsLabel(MAX_RESULTS, filtered.length)
                : `Refine to see more (${MAX_RESULTS} of ${filtered.length})`}
            </li>
          ) : null}
        </ul>
      </div>
    ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        onClick={toggleOpen}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-md border border-solid border-line-soft bg-surface-1 px-3 py-2 text-left text-sm outline-none transition-colors hover:border-accent focus:border-accent",
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
      {mounted && popover ? createPortal(popover, document.body) : null}
    </>
  );
}
