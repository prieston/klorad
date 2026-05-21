"use client";

import type { ReactNode } from "react";
import { cn } from "../utils/cn";
import { KloradMark } from "./klorad-mark";

export type WorkbenchTopBarProps = {
  /**
   * Product wordmark next to the Klorad mark — e.g. "Campus", "Mobility".
   * Defaults empty so apps can opt in.
   */
  product?: ReactNode;
  /** The name of the world being edited — typically the map's display name. */
  worldName?: ReactNode;
  /** Optional second line under the world name — id, role, etc. */
  worldSubtitle?: ReactNode;
  /**
   * Right-aligned actions slot. The shell renders these alongside the
   * actor indicator and the `⌘K` hint. Typically: Save button, share
   * button, a viewer button — high-frequency global ops.
   */
  actions?: ReactNode;
  /**
   * Short label for the current actor — "You", "AI · session-…", etc.
   * Rendered as a small chip on the right. Hide entirely by passing null.
   */
  actor?: ReactNode;
  /**
   * Show the `⌘K` palette hint chip. The shortcut is wired in the
   * shell — this is purely the visual affordance. Defaults to true.
   */
  showCommandHint?: boolean;
  className?: string;
};

/**
 * The Workbench's brand-level header strip.
 *
 * 48px tall, sits above the Dock. Centred-content style so the editor
 * reads as a product not a developer tool: brand mark left, world
 * context centre, actions / actor / palette hint right.
 *
 * Background uses `surface-1` with a hairline bottom border — keeps
 * the immersive 3D canvas below as the visual focus while still
 * giving the user a persistent anchor.
 */
export function WorkbenchTopBar({
  product,
  worldName,
  worldSubtitle,
  actions,
  actor,
  showCommandHint = true,
  className,
}: WorkbenchTopBarProps) {
  return (
    <header
      className={cn(
        "flex h-12 shrink-0 items-center gap-4 border-b border-line-soft bg-surface-1 px-4",
        className,
      )}
    >
      {/* Brand cluster — KloradMark + product wordmark. Stacked tight. */}
      <div className="flex shrink-0 items-center gap-2">
        <KloradMark className="h-6 w-6" />
        <div className="flex flex-col leading-none">
          <span className="text-[0.625rem] font-medium uppercase tracking-[0.18em] text-text-tertiary">
            Klorad
          </span>
          {product ? (
            <span className="text-xs font-semibold text-text-primary">
              {product}
            </span>
          ) : null}
        </div>
      </div>

      {worldName ? <div className="h-6 w-px bg-line-soft" /> : null}

      {/* World context — what the user is editing. */}
      {worldName ? (
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium text-text-primary">
            {worldName}
          </span>
          {worldSubtitle ? (
            <span className="truncate text-[0.7rem] text-text-tertiary">
              {worldSubtitle}
            </span>
          ) : null}
        </div>
      ) : (
        <div className="flex-1" />
      )}

      {/* Right rail — actions / actor / palette hint. */}
      <div className="flex shrink-0 items-center gap-2">
        {actions ? (
          <div className="flex items-center gap-1.5">{actions}</div>
        ) : null}
        {actor ? (
          <span className="hidden items-center gap-1.5 rounded-full border border-line-soft bg-bg px-2 py-1 text-[0.65rem] text-text-secondary sm:inline-flex">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
            {actor}
          </span>
        ) : null}
        {showCommandHint ? (
          <kbd className="hidden items-center gap-0.5 rounded-md border border-line-soft bg-surface-2 px-1.5 py-1 font-mono text-[0.6rem] text-text-tertiary md:inline-flex">
            ⌘K
          </kbd>
        ) : null}
      </div>
    </header>
  );
}
