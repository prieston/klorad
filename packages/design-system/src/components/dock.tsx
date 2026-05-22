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
  const ariaLabel = side === "left" ? "Left panel" : "Right panel";
  return (
    <aside
      className={cn(
        // The collapse animates. The centre map stays flash-free
        // because its canvas CSS-stretches to fill while the GL
        // buffer resize is throttled (~50ms) through the animation
        // (see useMapboxInitialization.ts + global.css).
        "flex h-full flex-col bg-surface-1 transition-[width] duration-300 ease-out",
        side === "left"
          ? "border-r border-line-soft"
          : "border-l border-line-soft",
        open ? "w-80" : "w-10",
      )}
    >
      {/*
        Chrome is intentionally minimal — just the collapse affordance.
        Views provide their own headers; doubling up looked utilitarian.
        Strip is 32px tall to feel lighter than the legacy 40px caps row.
      */}
      <div
        className={cn(
          "flex h-8 shrink-0 items-center px-1.5",
          open ? "justify-end" : "justify-center",
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? `Collapse ${ariaLabel}` : `Expand ${ariaLabel}`}
          aria-expanded={open}
          className="flex h-6 w-6 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-accent-soft hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Chevron direction={open === (side === "left") ? "left" : "right"} />
        </button>
      </div>
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
        // Animates — see DockColumn: the centre map's throttled
        // resize + CSS-stretched canvas keep the scene flash-free.
        "flex shrink-0 flex-col border-t border-line-soft bg-surface-1 transition-[height] duration-300 ease-out",
        open ? "h-64" : "h-8",
      )}
    >
      <div className="flex h-8 shrink-0 items-center justify-end px-1.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Collapse bottom panel" : "Expand bottom panel"}
          aria-expanded={open}
          className="flex h-6 w-6 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-accent-soft hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Chevron direction={open ? "down" : "up"} />
        </button>
      </div>
      {open ? (
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      ) : null}
    </section>
  );
}

function Chevron({
  direction,
}: {
  direction: "left" | "right" | "up" | "down";
}) {
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
