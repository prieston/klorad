"use client";

import type { View, ViewProps } from "@klorad/config/workbench";

/**
 * Phase 7 — AI co-pilot panel placeholder.
 *
 * The actor model (`ctx.actor`, `Actor: { kind: "user" | "ai" | "system" }`)
 * is wired in the shell; this view is the visible surface where the
 * AI co-pilot will live once a model is connected.
 *
 * For now: a hero state that shows what the panel will do once a
 * model is plugged in. Surfaces example prompts based on the
 * registered operations so the value prop is concrete instead of
 * "AI" hand-waving. Each prompt is illustrative — clicking them
 * doesn't run yet (model not connected).
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

  const opCount = ctx.applicableOperations.length;

  return (
    <div className="flex h-full gap-6 px-5 py-4">
      {/* Hero / brand cluster. */}
      <div className="flex w-64 shrink-0 flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="relative inline-flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-accent/30 to-accent/0 text-accent">
            <SparkleIcon className="h-4 w-4" />
          </span>
          <h2 className="text-sm font-semibold text-text-primary">
            AI co-pilot
          </h2>
        </div>
        <p className="text-[0.75rem] leading-relaxed text-text-secondary">
          Soon, ask the co-pilot to draw a building, place POIs from a
          spreadsheet, or summarise accessibility coverage. Approve
          changes before they run.
        </p>
        <div className="mt-2 flex items-center gap-2 text-[0.65rem] uppercase tracking-[0.14em] text-text-tertiary">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line-soft bg-bg px-2 py-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-text-tertiary" />
            Not connected
          </span>
          <span>Acting as: {actorLabel}</span>
        </div>
      </div>

      {/* Example prompts — what the co-pilot will be able to do. */}
      <div className="flex min-w-0 flex-1 flex-col gap-2 overflow-auto">
        <div className="text-[0.65rem] uppercase tracking-[0.14em] text-text-tertiary">
          Example prompts
        </div>
        <ExamplePrompt
          label="Place POIs from a CSV"
          hint="Upload a list of names + coordinates and let the co-pilot drop them on the map."
        />
        <ExamplePrompt
          label="Draw all buildings from OSM"
          hint="Use OpenStreetMap polygons to seed the campus's buildings, then refine."
        />
        <ExamplePrompt
          label="Summarise accessibility coverage"
          hint="Get a one-line audit: % of POIs with step-free access, missing notes, etc."
        />
        <ExamplePrompt
          label="Suggest tour stops"
          hint="Pick a 6-stop walking tour from the current POIs, balanced by category."
        />
        <p className="mt-2 text-[0.65rem] text-text-tertiary">
          {opCount} operation{opCount === 1 ? "" : "s"} currently
          applicable to your selection — the same surface the co-pilot
          will draw from when it ships.
        </p>
      </div>
    </div>
  );
}

function ExamplePrompt({ label, hint }: { label: string; hint: string }) {
  return (
    <div
      className="group rounded-xl border border-dashed border-line-soft bg-surface-1 px-3 py-2 text-left transition-colors"
      role="note"
      aria-label={label}
    >
      <div className="flex items-center gap-2 text-xs font-medium text-text-primary">
        <span className="text-text-tertiary">›</span>
        {label}
      </div>
      <p className="mt-0.5 pl-3 text-[0.7rem] text-text-tertiary">{hint}</p>
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
