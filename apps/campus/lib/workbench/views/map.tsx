"use client";

import type { View, ViewProps } from "@klorad/config/workbench";

/**
 * Phase 2 placeholder. Phase 3 wraps the existing builder 3D scene
 * (today: `apps/campus/maps/[mapId]/builder/BuilderClient`) as a
 * `View` that talks to the entity index rather than its own state.
 */
function MapViewComponent({ ctx }: ViewProps) {
  return (
    <div className="flex h-full items-center justify-center bg-bg p-8 text-center">
      <div className="max-w-md">
        <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-text-tertiary">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          Map view
        </span>
        <h2 className="mt-3 text-lg font-medium text-text-primary">
          The Workbench shell is mounted.
        </h2>
        <p className="mt-2 text-sm text-text-secondary">
          Editing world{" "}
          <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[0.8em] text-text-primary">
            {ctx.worldId}
          </code>
          . Phase 3 wraps the existing 3D scene here as a real View.
        </p>
        <p className="mt-4 text-xs text-text-tertiary">
          Selection: {ctx.selection.ids.size} entit
          {ctx.selection.ids.size === 1 ? "y" : "ies"} ·{" "}
          {ctx.entities.all().length} loaded
        </p>
      </div>
    </div>
  );
}

function MapIcon({ className }: { className?: string }) {
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
      <polygon points="1 6 8 3 16 6 23 3 23 18 16 21 8 18 1 21 1 6" />
      <line x1="8" y1="3" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="21" />
    </svg>
  );
}

export const mapView: View = {
  id: "map",
  label: "Map",
  icon: MapIcon,
  entityTypes: "*",
  defaultDock: "center",
  component: MapViewComponent,
};
