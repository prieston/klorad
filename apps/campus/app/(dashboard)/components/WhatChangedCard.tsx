import { History } from "lucide-react";

/**
 * Stub of the What Changed activity feed for the campus dashboard.
 *
 * The IHU mocks show a list of recent attributed actions ("Maria
 * Georgiou published news …" / "You changed primary colour to …"),
 * but no AuditLog model exists in the schema yet. Rather than
 * sprinkling fake entries that misrepresent the product, this card
 * ships as an empty state until the audit-log arc lands.
 *
 * When that arc happens, this becomes a thin renderer over a real
 * list — props change, layout stays.
 */
export function WhatChangedCard() {
  return (
    <section className="rounded-2xl border border-line-soft bg-surface-1 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary">
          What changed
        </h2>
        <span className="text-xs text-text-tertiary">last 7 days</span>
      </div>
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
        <div
          aria-hidden
          className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent"
        >
          <History size={18} strokeWidth={1.6} />
        </div>
        <p className="text-sm font-medium text-text-primary">No activity yet</p>
        <p className="max-w-xs text-xs text-text-tertiary">
          Edits to this campus appear here so the team can see what changed
          and by whom.
        </p>
      </div>
    </section>
  );
}
