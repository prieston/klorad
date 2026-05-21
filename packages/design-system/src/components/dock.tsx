"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { cn } from "../utils/cn";

export type DockProps = {
  /** Optional left panel — collapses to a 40px chrome rail. */
  left?: ReactNode;
  /** Required center panel — always visible, always fills the remainder. */
  center: ReactNode;
  /** Optional right panel — collapses to a 40px chrome rail. */
  right?: ReactNode;
  /** Optional bottom panel — collapses to a 40px chrome rail. */
  bottom?: ReactNode;
  className?: string;
};

/**
 * The Workbench dock layout — four named regions: `left`, `center`,
 * `right`, `bottom`. v1 supports collapse / expand on the three
 * optional regions only; drag-to-resize, drag-to-rearrange, and
 * layout persistence are deliberately deferred (see WORKBENCH.md §6).
 *
 * The dock fills its parent's height. Mount inside a container that
 * gives it a defined height (e.g. `h-screen` or `h-[calc(100vh-4rem)]`).
 */
export function Dock({ left, center, right, bottom, className }: DockProps) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col bg-bg text-text-primary",
        className,
      )}
    >
      <div className="flex min-h-0 flex-1">
        {left ? <DockColumn side="left">{left}</DockColumn> : null}
        <main className="min-w-0 flex-1 overflow-hidden">{center}</main>
        {right ? <DockColumn side="right">{right}</DockColumn> : null}
      </div>
      {bottom ? <DockBottom>{bottom}</DockBottom> : null}
    </div>
  );
}

function DockColumn({
  side,
  children,
}: {
  side: "left" | "right";
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const label = side === "left" ? "Left" : "Right";
  return (
    <aside
      className={cn(
        "flex h-full flex-col bg-surface-1 transition-[width] duration-200",
        side === "left" ? "border-r border-line-soft" : "border-l border-line-soft",
        open ? "w-72" : "w-10",
      )}
    >
      <header
        className={cn(
          "flex h-10 shrink-0 items-center border-b border-line-soft px-2 text-[0.7rem] uppercase tracking-[0.18em] text-text-tertiary",
          open ? "justify-between" : "justify-center",
        )}
      >
        {open ? <span>{label}</span> : null}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={`Toggle ${side} panel`}
          aria-expanded={open}
          className="flex h-6 w-6 items-center justify-center rounded text-text-secondary transition-colors hover:bg-accent-soft hover:text-text-primary"
        >
          <Chevron direction={open === (side === "left") ? "left" : "right"} />
        </button>
      </header>
      {open ? (
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      ) : null}
    </aside>
  );
}

function DockBottom({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section
      className={cn(
        "flex shrink-0 flex-col border-t border-line-soft bg-surface-1 transition-[height] duration-200",
        open ? "h-56" : "h-10",
      )}
    >
      <header className="flex h-10 shrink-0 items-center justify-between border-b border-line-soft px-2 text-[0.7rem] uppercase tracking-[0.18em] text-text-tertiary">
        <span>{open ? "Bottom" : null}</span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle bottom panel"
          aria-expanded={open}
          className="flex h-6 w-6 items-center justify-center rounded text-text-secondary transition-colors hover:bg-accent-soft hover:text-text-primary"
        >
          <Chevron direction={open ? "down" : "up"} />
        </button>
      </header>
      {open ? (
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      ) : null}
    </section>
  );
}

function Chevron({ direction }: { direction: "left" | "right" | "up" | "down" }) {
  const rotation = {
    left: "rotate-90",
    right: "-rotate-90",
    up: "rotate-180",
    down: "",
  }[direction];
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("transition-transform", rotation)}
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
