"use client";

import { useEffect, useRef, useState } from "react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../utils/cn";

export type MenuProps = {
  /** The clickable trigger element. */
  trigger: ReactNode;
  children: ReactNode;
  /** Horizontal alignment of the panel against the trigger. Default `end`. */
  align?: "start" | "end";
  className?: string;
};

/**
 * A dropdown menu anchored to a trigger. Manages its own open state;
 * closes on outside click, Escape, or any click inside the panel.
 */
export function Menu({ trigger, children, align = "end", className }: MenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={cn("relative inline-flex", className)}>
      <span onClick={() => setOpen((v) => !v)}>{trigger}</span>
      {open && (
        <div
          role="menu"
          onClick={() => setOpen(false)}
          className={cn(
            "absolute top-full z-50 mt-1 min-w-[10rem] overflow-hidden rounded-lg",
            "border border-line-soft bg-surface-1 py-1 shadow-glass",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export type MenuItemProps = ComponentProps<"button"> & {
  tone?: "default" | "danger";
};

/** A single row inside a `Menu`. */
export function MenuItem({ tone = "default", className, ...props }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors",
        tone === "danger"
          ? "text-red-600 hover:bg-red-500/10 dark:text-red-400"
          : "text-text-secondary hover:bg-accent-soft hover:text-text-primary",
        className,
      )}
      {...props}
    />
  );
}
