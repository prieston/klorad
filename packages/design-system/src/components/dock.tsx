"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { cn } from "../utils/cn";

export type DockProps = {
  /** Optional left panel — collapses to a 40px chrome rail. */
  left?: ReactNode;
  /** Required center panel — the scene; always full-bleed behind the panels. */
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
 * The `center` region (the 3D scene) is rendered full-bleed *behind*
 * the panels rather than as a flex sibling they squeeze. Collapsing a
 * panel therefore never resizes the scene — the panel just slides
 * over it — so an animated collapse can never flash a WebGL canvas
 * mid-resize. The panels float in a `pointer-events-none` layer so
 * clicks fall through the empty centre to the scene.
 *
 * Scene-anchored overlay UI (toolbars, switchers) should portal into
 * the `[data-dock-center]` slot so it tracks the panels instead of
 * hiding beneath them.
 *
 * The dock fills its parent's height. Mount inside a container that
 * gives it a defined height (e.g. `h-screen` or `h-[calc(100vh-4rem)]`).
 */
export function Dock({ left, center, right, bottom, className }: DockProps) {
  return (
    <div
      className={cn(
        "relative h-full min-h-0 overflow-hidden bg-bg text-text-primary",
        className,
      )}
    >
      {/* Scene layer — fills the whole dock, sits behind the panels.
          `z-0` makes it a stacking context so the map's own controls
          (e.g. the Mapbox attribution) can't paint above the panels. */}
      <main className="absolute inset-0 z-0 overflow-hidden">{center}</main>

      {/* Panel layer — floats over the scene. `pointer-events-none`
          here + `-auto` on each panel lets clicks fall through the
          empty centre slot to the scene below. */}
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col">
        <div className="flex min-h-0 flex-1">
          {left ? <DockColumn side="left">{left}</DockColumn> : null}
          {/* Centre slot — scene-anchored overlay UI portals in here
              so it stays between the panels, not under them. */}
          <div
            data-dock-center
            className="pointer-events-none relative min-w-0 flex-1"
          />
          {right ? <DockColumn side="right">{right}</DockColumn> : null}
        </div>
        {bottom ? <DockBottom>{bottom}</DockBottom> : null}
      </div>
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
        // Animates freely — the scene sits behind this panel, not
        // beside it, so a collapse never resizes the WebGL canvas.
        "pointer-events-auto flex h-full flex-col bg-surface-1 transition-[width] duration-300 ease-out",
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
        // Animates freely — see DockColumn: the scene is behind, not
        // above, so no resize and no flash.
        "pointer-events-auto flex shrink-0 flex-col border-t border-line-soft bg-surface-1 transition-[height] duration-300 ease-out",
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
