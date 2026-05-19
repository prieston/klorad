import type { ComponentProps } from "react";
import { cn } from "../utils/cn";

export type BadgeTone = "neutral" | "accent" | "warning" | "danger";

const toneClass: Record<BadgeTone, string> = {
  neutral: "border-line-soft bg-surface-2 text-text-secondary",
  accent: "border-transparent bg-accent-soft text-accent",
  warning:
    "border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400",
  danger: "border-red-500/30 bg-red-500/15 text-red-600 dark:text-red-400",
};

export type BadgeProps = ComponentProps<"span"> & {
  tone?: BadgeTone;
};

/** A small status pill — roles, states, counts. */
export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        toneClass[tone],
        className,
      )}
      {...props}
    />
  );
}
