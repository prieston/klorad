"use client";

import { useCallback, useState } from "react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../utils/cn";

/* ─── Types ───────────────────────────────────────────────────────── */

export type WorkflowStep = {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  /** Inline copy that appears under the active tab. */
  description?: ReactNode;
  /**
   * Lazy renderer for the step's content. Render-prop (not a bound
   * `ReactNode`) so only the active step's tree is created — keeps
   * inactive steps cheap when they read large entity lists.
   */
  render(): ReactNode;
};

/* ─── WorkflowPanel ───────────────────────────────────────────────── */

export type WorkflowPanelProps = {
  /** Optional heading rendered above the tab bar. */
  title?: ReactNode;
  steps: WorkflowStep[];
  /** Starting step id. Defaults to `steps[0].id`. */
  defaultStep?: string;
  className?: string;
};

/**
 * The Workbench's "Workflow" panel — a small set of guided steps
 * the author works through left-to-right. Each vertical (campus,
 * mobility, …) supplies its own `steps` array; the shell here owns
 * the tab state, the description band, and the content scroller.
 *
 * Layout:
 *   - Optional header (`title`)
 *   - Tab bar (horizontal pills, icon-above-label)
 *   - Description band for the active step
 *   - Scrollable content area
 *
 * Built on top of `WorkflowTabBar` + `WorkflowListItem` so each
 * step's body can drop the same primitives without re-implementing
 * card / row styling.
 */
export function WorkflowPanel({
  title,
  steps,
  defaultStep,
  className,
}: WorkflowPanelProps) {
  const initial = defaultStep ?? steps[0]?.id ?? "";
  const [current, setCurrent] = useState(initial);
  const activeStep = steps.find((s) => s.id === current) ?? steps[0];
  if (!activeStep) return null;
  return (
    <div
      className={cn(
        "flex h-full min-h-0 min-w-0 flex-col",
        className,
      )}
    >
      {title ? (
        <header className="px-4 pb-2 pt-1">
          <h2 className="text-base font-semibold tracking-tight text-text-primary">
            {title}
          </h2>
        </header>
      ) : null}
      <WorkflowTabBar
        steps={steps}
        current={current}
        onChange={setCurrent}
      />
      {activeStep.description ? (
        <div className="border-b border-line-soft px-4 py-3">
          <p className="text-xs leading-relaxed text-text-secondary">
            {activeStep.description}
          </p>
        </div>
      ) : null}
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-3">
        {activeStep.render()}
      </div>
    </div>
  );
}

/* ─── WorkflowTabBar ──────────────────────────────────────────────── */

export type WorkflowTabBarProps = {
  steps: Pick<WorkflowStep, "id" | "label" | "icon">[];
  current: string;
  onChange(id: string): void;
  className?: string;
};

/**
 * Horizontal row of equal-width tab pills, each stacking its icon
 * above a tiny uppercase label. Active = accent-soft + accent; idle
 * = transparent + tertiary; hover lifts surface-2.
 */
export function WorkflowTabBar({
  steps,
  current,
  onChange,
  className,
}: WorkflowTabBarProps) {
  return (
    <div className={cn("flex gap-1 px-3 pb-2", className)}>
      {steps.map((s) => {
        const isActive = s.id === current;
        const Icon = s.icon;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange(s.id)}
            title={s.label}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2.5 transition-colors",
              isActive
                ? "bg-accent-soft text-accent"
                : "text-text-tertiary hover:bg-surface-2 hover:text-text-primary",
            )}
          >
            {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
            <span className="text-[0.6rem] font-medium uppercase tracking-[0.06em]">
              {s.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ─── WorkflowListItem + WorkflowListButton ───────────────────────── */

type WorkflowListBase = {
  selected?: boolean;
  className?: string;
};

export type WorkflowListItemProps = ComponentProps<"div"> & WorkflowListBase;

/**
 * A row container styled as: empty interior + 1px grey border at
 * rest, `border-accent` on hover, `border-accent bg-accent-soft` on
 * select. Use when the row has multiple action buttons inside (e.g.
 * a tap-to-select button plus a chevron drill button).
 */
export function WorkflowListItem({
  selected,
  className,
  children,
  ...props
}: WorkflowListItemProps) {
  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-2xl border p-4 transition-colors",
        selected
          ? "border-accent bg-accent-soft"
          : "border-line-soft bg-transparent hover:border-accent",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export type WorkflowListButtonProps = ComponentProps<"button"> &
  WorkflowListBase;

/**
 * Same styling as `WorkflowListItem` but the root is a `<button>` —
 * use when the whole row should be one click target (no inner
 * action buttons).
 */
export function WorkflowListButton({
  selected,
  className,
  type = "button",
  children,
  ...props
}: WorkflowListButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "group flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-colors",
        selected
          ? "border-accent bg-accent-soft text-accent"
          : "border-line-soft bg-transparent text-text-secondary hover:border-accent hover:text-text-primary",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/* ─── WorkflowDrillHeader ─────────────────────────────────────────── */

export type WorkflowDrillHeaderProps = {
  /** Label of the level the user is leaving (the parent). */
  label: ReactNode;
  onBack(): void;
  className?: string;
};

/**
 * "← Back to {parent}" affordance for nested drill-down screens
 * inside a workflow step. Renders as a small tertiary-text button
 * that lifts to text-primary on hover.
 */
export function WorkflowDrillHeader({
  label,
  onBack,
  className,
}: WorkflowDrillHeaderProps) {
  return (
    <button
      type="button"
      onClick={onBack}
      className={cn(
        "group flex items-center gap-1.5 text-[0.7rem] font-medium text-text-tertiary transition-colors hover:text-text-primary",
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3 w-3"
        aria-hidden
      >
        <path d="m15 18-6-6 6-6" />
      </svg>
      <span className="truncate">{label}</span>
    </button>
  );
}

/* ─── useWorkflowDrill ────────────────────────────────────────────── */

export type WorkflowDrillAPI<T = string> = {
  /** The full stack — empty at root, [a] one level deep, [a, b] two, … */
  path: T[];
  /** `path.length` — 0 = root. */
  depth: number;
  push(id: T): void;
  pop(): void;
  reset(): void;
};

/**
 * Manages a navigation stack inside a workflow step (list → detail
 * → detail-of-detail). The step decides what to render based on the
 * current `path`; `push` / `pop` / `reset` mutate the stack.
 *
 * Type-parameterised so steps can carry richer level state when a
 * string id isn't enough.
 */
export function useWorkflowDrill<T = string>(initial: T[] = []) {
  const [path, setPath] = useState<T[]>(initial);
  const push = useCallback((id: T) => setPath((p) => [...p, id]), []);
  const pop = useCallback(() => setPath((p) => p.slice(0, -1)), []);
  const reset = useCallback(() => setPath([]), []);
  const api: WorkflowDrillAPI<T> = { path, depth: path.length, push, pop, reset };
  return api;
}
