"use client";

import type { ComponentProps, ReactNode } from "react";
import { cn } from "../utils/cn";

export type EmptyStateProps = ComponentProps<"div"> & {
  /** Optional brand-tinted icon — rendered inside an accent-soft circle. */
  icon?: React.ComponentType<{ className?: string }>;
  /** Headline. Required. */
  title: ReactNode;
  /** Supporting copy below the title. */
  body?: ReactNode;
  /** Action slot — usually one or two buttons. */
  action?: ReactNode;
  /** `solid` (default — bg-bg card) or `dashed` (placeholder feel). */
  tone?: "solid" | "dashed";
};

/**
 * Reusable empty state — same visual rhythm across every Klorad
 * vertical's dashboard, workbench, and public viewer.
 *
 * Layout: brand-tinted icon circle → title → body → action slot.
 * `tone="dashed"` for "nothing here yet" placeholders; `solid` for
 * "you've reached the end of the list" terminal states.
 *
 * Sized for a card (~280–480px wide) but degrades to full-width on
 * narrow surfaces — the icon and text stay centred.
 */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  tone = "solid",
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl p-6 text-center",
        tone === "dashed"
          ? "border border-dashed border-line-soft bg-transparent"
          : "border border-line-soft bg-bg",
        className,
      )}
      {...props}
    >
      {Icon ? (
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Icon className="h-5 w-5" />
        </span>
      ) : null}
      <div className="space-y-1">
        <h3 className="text-sm font-medium text-text-primary">{title}</h3>
        {body ? (
          <p className="text-xs leading-relaxed text-text-tertiary">{body}</p>
        ) : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
