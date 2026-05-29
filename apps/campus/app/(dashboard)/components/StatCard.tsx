import type { ReactNode } from "react";

interface Props {
  icon: ReactNode;
  /** Big number — pass `"—"` for stats that don't have a backend yet. */
  value: string;
  /** Short label under the number. */
  label: string;
  /** Optional secondary line — e.g. "↑ 12% vs last month". */
  trend?: ReactNode;
}

/**
 * The headline KPI card used across every backoffice overview screen.
 * Icon in a soft accent tile, big light value, label below, optional
 * trend chip in muted text.
 */
export function StatCard({ icon, value, label, trend }: Props) {
  return (
    <div className="rounded-2xl border border-line-soft bg-surface-1 p-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
        {icon}
      </div>
      <div className="mt-4 text-2xl font-light text-text-primary">{value}</div>
      <div className="mt-0.5 text-sm text-text-secondary">{label}</div>
      {trend ? (
        <div className="mt-2 text-xs text-text-tertiary">{trend}</div>
      ) : null}
    </div>
  );
}
