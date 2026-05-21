"use client";

import type { ComponentProps, ReactNode } from "react";
import { cn } from "../utils/cn";
import { Button, type ButtonProps } from "./button";

/* ─── WorkbenchSection ─────────────────────────────────────────────────
 *
 * One titled section inside a Workbench view. Replaces the ad-hoc
 * `<div className="rounded-lg border border-line-soft p-3">…</div>`
 * patterns the views were inlining.
 *
 * Visual contract matches the dashboard cards (`rounded-2xl`, soft
 * border, generous padding) so the Workbench reads as the same
 * product, not a separate utility. Use `tone="dashed"` for placeholder
 * surfaces (selection cards, "drop here", etc.).
 * ──────────────────────────────────────────────────────────────────── */

export type WorkbenchSectionTone = "solid" | "soft" | "dashed";

const toneClass: Record<WorkbenchSectionTone, string> = {
  /* The default — an elevated card on top of the dock surface. */
  solid: "border border-line-soft bg-surface-1",
  /* A muted card — the dock is already surface-1, so we tint with bg. */
  soft: "border border-line-soft bg-bg",
  /* A placeholder card — selection panels, empty states. */
  dashed: "border border-dashed border-line-soft bg-transparent",
};

export interface WorkbenchSectionProps
  extends Omit<ComponentProps<"section">, "title"> {
  /** Section heading — small caps label or sentence-case title. */
  title?: ReactNode;
  /** Secondary line under the title (count, id, hint). */
  subtitle?: ReactNode;
  /** Right-aligned actions in the header (button, link, badge). */
  actions?: ReactNode;
  /** Surface tone. Default `solid`. */
  tone?: WorkbenchSectionTone;
}

export function WorkbenchSection({
  title,
  subtitle,
  actions,
  tone = "solid",
  className,
  children,
  ...props
}: WorkbenchSectionProps) {
  const hasHeader = title || subtitle || actions;
  return (
    <section
      className={cn(
        "rounded-2xl p-5",
        toneClass[tone],
        className,
      )}
      {...props}
    >
      {hasHeader ? (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            {title ? (
              <h3 className="text-sm font-semibold text-text-primary">
                {title}
              </h3>
            ) : null}
            {subtitle ? (
              <p className="truncate text-xs text-text-tertiary">{subtitle}</p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 items-center gap-1.5">{actions}</div>
          ) : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

/* ─── WorkbenchStatTile ────────────────────────────────────────────────
 *
 * A label + value tile. Used in OverviewView for entity counts; future
 * verticals will use it for whatever single-number snapshots they want
 * to surface (active vehicles, restored fragments, etc.).
 *
 * Mirrors the dashboard's stat cards but sized for a dock column —
 * `rounded-xl` + `p-4` instead of the dashboard's `rounded-2xl + p-6`.
 * ──────────────────────────────────────────────────────────────────── */

export interface WorkbenchStatTileProps
  extends Omit<ComponentProps<"div">, "title"> {
  /** Short uppercase label above the value. */
  label: ReactNode;
  /** The headline number / value. */
  value: ReactNode;
  /** Optional hint line below (e.g. `12 / 248`). */
  hint?: ReactNode;
  /** Optional icon shown to the left of the label. */
  icon?: React.ComponentType<{ className?: string }>;
}

export function WorkbenchStatTile({
  label,
  value,
  hint,
  icon: Icon,
  className,
  ...props
}: WorkbenchStatTileProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-line-soft bg-surface-1 p-4",
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-1.5 text-[0.7rem] uppercase tracking-[0.14em] text-text-tertiary">
        {Icon ? <Icon className="h-3 w-3" /> : null}
        {label}
      </div>
      <div className="mt-1.5 text-2xl font-light tabular-nums text-text-primary">
        {value}
      </div>
      {hint ? (
        <div className="mt-0.5 text-xs text-text-tertiary">{hint}</div>
      ) : null}
    </div>
  );
}

/* ─── WorkbenchOperationButton ─────────────────────────────────────────
 *
 * One button that fires a Workbench operation. Decoupled from
 * `ResolvedOperation` so non-Workbench callers can use it too — pass
 * the label, optional icon, and an `onClick`.
 *
 * Defaults to `primary` for surfaced actions in selection / world
 * panels; pass `variant="secondary"` for less hot actions.
 * ──────────────────────────────────────────────────────────────────── */

export interface WorkbenchOperationButtonProps
  extends Omit<ButtonProps, "children"> {
  /** Button label (e.g., the operation's `label` field). */
  label: ReactNode;
  /** Optional icon — the operation's `icon` field. */
  icon?: React.ComponentType<{ className?: string }>;
}

export function WorkbenchOperationButton({
  label,
  icon: Icon,
  size = "sm",
  variant = "primary",
  className,
  ...props
}: WorkbenchOperationButtonProps) {
  return (
    <Button size={size} variant={variant} className={className} {...props}>
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {label}
    </Button>
  );
}
