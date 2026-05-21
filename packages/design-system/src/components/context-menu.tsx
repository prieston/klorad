"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ResolvedOperation } from "@klorad/config/workbench";
import { cn } from "../utils/cn";

export type ContextMenuProps = {
  /** Viewport coordinates of the right-click. */
  x: number;
  y: number;
  /** The list of ops to surface — typically `ctx.operationsForEntity(id)`. */
  operations: ResolvedOperation[];
  /** Fired when the user picks an op. The menu closes after. */
  onRun: (resolved: ResolvedOperation) => void;
  /** Fired when the menu should close — outside click, Esc, or after run. */
  onClose: () => void;
};

/**
 * The Workbench right-click context menu — Phase 5c3.
 *
 * Pure presentation: receives a coordinate, a list of resolved ops,
 * and `onRun` / `onClose` callbacks. Views own the open/closed
 * state because right-clicks come from different surfaces (table
 * rows, hierarchy tree nodes, map pins) with different bounding
 * logic.
 *
 * Auto-adjusts position to stay on-screen — if the menu would
 * overflow right or bottom, it flips to anchor from the opposite
 * edge. Closes on outside click and `Esc`.
 *
 * Render unconditionally; it returns `null` when `operations` is
 * empty so the caller can pass through filtered results without
 * branching.
 */
export function ContextMenu({
  x,
  y,
  operations,
  onRun,
  onClose,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });

  // Reposition after mount once the menu's real size is measurable.
  // Flip to anchor right / bottom if we'd overflow the viewport.
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const PAD = 8;
    let left = x;
    let top = y;
    if (x + rect.width + PAD > vw) left = Math.max(PAD, vw - rect.width - PAD);
    if (y + rect.height + PAD > vh) top = Math.max(PAD, vh - rect.height - PAD);
    setPosition({ left, top });
  }, [x, y, operations.length]);

  // Outside-click + Esc dismiss. mousedown so it beats child clicks
  // (otherwise a click on a menu row would close before fire).
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (operations.length === 0) return null;

  return (
    <div
      ref={menuRef}
      role="menu"
      style={{ left: position.left, top: position.top }}
      className="fixed z-[110] min-w-[12rem] overflow-hidden rounded-lg border border-line-soft bg-surface-1 py-1 shadow-glass"
      onContextMenu={(e) => e.preventDefault()}
    >
      {operations.map((resolved) => {
        const op = resolved.operation;
        const Icon = op.icon;
        return (
          <button
            key={op.id}
            type="button"
            role="menuitem"
            onClick={() => {
              onRun(resolved);
              onClose();
            }}
            className={cn(
              "flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors",
              "text-text-secondary hover:bg-accent-soft hover:text-text-primary",
              "focus-visible:bg-accent-soft focus-visible:text-text-primary focus-visible:outline-none",
            )}
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center text-text-tertiary">
              {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
            </span>
            <span className="flex-1 truncate">{op.label}</span>
          </button>
        );
      })}
    </div>
  );
}
