"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ResolvedOperation } from "@klorad/config/workbench";
import { cn } from "../utils/cn";

export type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
  /** The list to surface — typically `ctx.applicableOperations`. */
  operations: ResolvedOperation[];
  /** Fired when the user picks an operation. The palette closes after. */
  onRun: (resolved: ResolvedOperation) => void;
};

/**
 * The Workbench command palette — Phase 5c2.
 *
 * Renders a search-driven list of `ResolvedOperation`s. The shell
 * binds `mod+k` to toggle it and pipes its computed
 * `applicableOperations` straight in.
 *
 * Keyboard:
 *   - `↑ / ↓` — move the highlight
 *   - `Enter` — invoke the highlighted op
 *   - `Esc`   — close
 *   - typing — filters by op label (case-insensitive)
 *
 * Closes on backdrop click. Locks body scroll while open. The
 * palette renders nothing when `open === false`.
 */
export function CommandPalette({
  open,
  onClose,
  operations,
  onRun,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return operations;
    return operations.filter((r) =>
      r.operation.label.toLowerCase().includes(trimmed),
    );
  }, [query, operations]);

  // Reset on open — clean slate, focus input.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    // requestAnimationFrame so the input is mounted before focus.
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  // Clamp activeIndex when the filtered list shrinks under it.
  useEffect(() => {
    if (activeIndex >= filtered.length) {
      setActiveIndex(filtered.length === 0 ? 0 : filtered.length - 1);
    }
  }, [filtered.length, activeIndex]);

  // Scroll the active row into view on highlight changes.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const row = list.children[activeIndex] as HTMLElement | undefined;
    row?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  // Keyboard + scroll lock while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const item = filtered[activeIndex];
        if (item) {
          onRun(item);
          onClose();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose, filtered, activeIndex, onRun]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[14vh]">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="animate-fade-up relative w-full max-w-xl overflow-hidden rounded-2xl border border-line-soft bg-surface-1 shadow-glass"
      >
        <div className="flex items-center gap-2 border-b border-line-soft px-4 py-3">
          <SearchIcon className="h-4 w-4 shrink-0 text-text-tertiary" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            placeholder="Type a command…"
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
          />
          <kbd className="hidden shrink-0 rounded border border-line-soft bg-surface-2 px-1.5 py-0.5 font-mono text-[0.65rem] text-text-tertiary sm:inline">
            Esc
          </kbd>
        </div>
        <ul ref={listRef} className="max-h-[48vh] overflow-auto py-1">
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm text-text-tertiary">
              No matching commands.
            </li>
          ) : (
            filtered.map((resolved, i) => {
              const op = resolved.operation;
              const Icon = op.icon;
              const isActive = i === activeIndex;
              return (
                <li
                  key={op.id}
                  role="option"
                  aria-selected={isActive}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => {
                    onRun(resolved);
                    onClose();
                  }}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 px-4 py-2 transition-colors",
                    isActive
                      ? "bg-accent-soft text-text-primary"
                      : "text-text-secondary",
                  )}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center text-text-tertiary">
                    {Icon ? <Icon className="h-4 w-4" /> : <DotIcon />}
                  </span>
                  <span className="flex-1 truncate text-sm">{op.label}</span>
                  <span className="hidden font-mono text-[0.65rem] text-text-tertiary sm:inline">
                    {op.id}
                  </span>
                </li>
              );
            })
          )}
        </ul>
        <div className="flex items-center justify-between gap-2 border-t border-line-soft bg-surface-1 px-4 py-2 text-[0.65rem] text-text-tertiary">
          <span className="flex items-center gap-2">
            <Hint k="↑↓" label="Navigate" />
            <Hint k="↵" label="Run" />
            <Hint k="Esc" label="Close" />
          </span>
          <span>
            {filtered.length} of {operations.length}
          </span>
        </div>
      </div>
    </div>
  );
}

function Hint({ k, label }: { k: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <kbd className="rounded border border-line-soft bg-surface-2 px-1 py-0.5 font-mono">
        {k}
      </kbd>
      <span>{label}</span>
    </span>
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

function DotIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-1.5 w-1.5"
      aria-hidden
    >
      <circle cx="12" cy="12" r="6" />
    </svg>
  );
}
