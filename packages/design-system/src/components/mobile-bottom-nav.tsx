"use client";

import type { ReactNode } from "react";
import { cn } from "../utils/cn";

export type MobileBottomNavItem = {
  /** Stable key — matched against `activeKey` to decide the active pill. */
  key: string;
  /** Visible label, animated in when this item is active. */
  label: string;
  /** Icon component — receives `className` so it inherits size + colour. */
  icon: React.ComponentType<{ className?: string }>;
};

export type MobileBottomNavProps = {
  items: MobileBottomNavItem[];
  /** The currently-active item's key. */
  activeKey: string;
  /**
   * Render-prop for each item's wrapper. Verticals are free to pick
   * their own routing primitive (Next `Link`, `<a>`, button) — the
   * primitive just hands back the styled inner content and lets the
   * caller wrap it. The classes already cover positioning, spacing,
   * and the active-pill background.
   */
  renderItem(item: MobileBottomNavItem, content: ReactNode, isActive: boolean): ReactNode;
  className?: string;
};

/**
 * Pill-style mobile bottom nav. Active item expands to show its
 * label inside an accent-filled rounded-full pill; inactive items
 * collapse to an icon-only tap target. Fixed to the bottom of the
 * viewport with safe-area-inset bottom padding so it clears the
 * home indicator on iOS.
 *
 * The component is engine-agnostic about routing — wrap each item
 * in whatever `<Link>` / `<a>` / `<button>` the host app uses by
 * implementing `renderItem`. The primitive owns the styling +
 * active-state transitions; the caller owns the destination.
 */
export function MobileBottomNav({
  items,
  activeKey,
  renderItem,
  className,
}: MobileBottomNavProps) {
  return (
    <nav
      aria-label="Primary"
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3",
        // Fade gradient behind the nav — pure-white at the bottom
        // bleeding to transparent ~6rem up. Tells the visitor that
        // content scrolled under the nav still exists ("there's
        // more, keep scrolling") without hiding it outright.
        // `content-['']` is the bit that makes Tailwind actually
        // emit the pseudo-element; without it the `before:*`
        // utilities are no-ops.
        "before:pointer-events-none before:absolute before:inset-x-0 before:bottom-0 before:-z-10 before:h-[8rem] before:bg-gradient-to-t before:from-white before:via-white/85 before:to-transparent before:content-['']",
        "pt-[6rem] pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        className,
      )}
    >
      <ul
        className={cn(
          "pointer-events-auto flex w-full max-w-[420px] list-none items-center justify-around gap-1 rounded-full",
          "border border-solid border-black/5 bg-white/95 p-1.5 backdrop-blur",
          "shadow-[0_8px_28px_-12px_rgba(0,0,0,0.25)]",
        )}
      >
        {items.map((item) => {
          const isActive = item.key === activeKey;
          const Icon = item.icon;
          const content = (
            <span
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-full transition-all duration-200 ease-out",
                isActive
                  ? "bg-accent px-4 py-2 text-accent-contrast"
                  : "px-3 py-2 text-text-tertiary",
              )}
            >
              <Icon
                className={cn(
                  "h-[18px] w-[18px] shrink-0",
                  isActive ? "" : "opacity-90",
                )}
              />
              <span
                className={cn(
                  "overflow-hidden whitespace-nowrap text-sm font-semibold transition-[max-width,opacity] duration-200 ease-out",
                  isActive ? "max-w-[120px] opacity-100" : "max-w-0 opacity-0",
                )}
              >
                {item.label}
              </span>
            </span>
          );
          return (
            <li key={item.key} className="flex-1">
              {renderItem(item, content, isActive)}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
