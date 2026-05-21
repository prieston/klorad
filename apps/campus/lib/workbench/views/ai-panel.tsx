"use client";

import { WorkbenchSection } from "@klorad/design-system";
import type { View, ViewProps } from "@klorad/config/workbench";

/**
 * Phase 7 — AI co-pilot panel placeholder.
 *
 * The actor model (`ctx.actor`, `Actor: { kind: "user" | "ai" | "system" }`)
 * is wired in the shell; this view is the visible surface where the
 * AI co-pilot will live once a model is connected.
 *
 * For v1: status-only. Lists nothing, suggests nothing, runs nothing.
 * The placeholder lets us validate the dock layout (bottom region +
 * collapse animation) before the model integration lands.
 *
 * Approval-gating happens in `Workbench.runOperation` — when
 * `actor.kind === "ai"`, the shell will route the op through a
 * confirmation flow before invoking. That gate lights up the first
 * time an AI-authored op runs.
 */
function AIPanelComponent({ ctx }: ViewProps) {
  const actorLabel =
    ctx.actor.kind === "user"
      ? `You · ${ctx.actor.userId}`
      : ctx.actor.kind === "ai"
        ? `AI · ${ctx.actor.sessionId}`
        : `System · ${ctx.actor.reason}`;

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">
            AI co-pilot
          </h2>
          <p className="text-[0.7rem] text-text-tertiary">
            Acting as: {actorLabel}
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-line-soft bg-surface-2 px-2 py-1 text-[0.65rem] uppercase tracking-[0.14em] text-text-tertiary">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-text-tertiary" />
          Not connected
        </span>
      </header>

      <WorkbenchSection tone="dashed">
        <p className="text-xs text-text-tertiary">
          The actor model is wired and operations are typed end-to-end,
          so the shell knows how to route an AI-authored op through an
          approval gate before invoking. The model itself plugs in via
          a follow-up — until then, ops only run when a user clicks them.
        </p>
      </WorkbenchSection>
    </div>
  );
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 3v3" />
      <path d="M12 18v3" />
      <path d="M5 12H3" />
      <path d="M21 12h-2" />
      <path d="M18.4 5.6 17 7" />
      <path d="M7 17l-1.4 1.4" />
      <path d="M18.4 18.4 17 17" />
      <path d="M7 7 5.6 5.6" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export const aiPanelView: View = {
  id: "ai-panel",
  label: "AI co-pilot",
  icon: SparkleIcon,
  entityTypes: "*",
  defaultDock: "bottom",
  component: AIPanelComponent,
};
