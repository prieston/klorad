"use client";

import { WorkflowPanel, type WorkflowStep } from "@klorad/design-system";
import type { View, ViewProps } from "@klorad/config/workbench";
import { BuildingsStep } from "./buildings-step";
import { LocationStep } from "./location-step";
import { PoisStep } from "./pois-step";

/**
 * Campus's left-dock workflow view.
 *
 * The shell (tab bar, description band, content scroller, drill
 * navigation primitives) lives in `@klorad/design-system`'s
 * `WorkflowPanel`. This file only defines campus's steps and
 * mounts the shell — the same pattern every Klorad vertical
 * follows to define its own workflow.
 */
function WorkflowViewComponent({ ctx }: ViewProps) {
  const steps: WorkflowStep[] = [
    {
      id: "location",
      label: "Location",
      icon: LocationIcon,
      description:
        "Define where your campus sits. The current map view becomes the initial camera position visitors land on.",
      render: () => <LocationStep />,
    },
    {
      id: "buildings",
      label: "Buildings",
      icon: BuildingIcon,
      description:
        "Draw your campus's buildings, then drill into each one to add floors and rooms.",
      render: () => <BuildingsStep ctx={ctx} />,
    },
    {
      id: "pois",
      label: "POIs",
      icon: PoiIcon,
      description:
        "Tag the places visitors search for — entrances, departments, cafés, accessibility info.",
      render: () => <PoisStep ctx={ctx} />,
    },
  ];

  return <WorkflowPanel title="Workflow" steps={steps} />;
}

/* ─── Icons ───────────────────────────────────────────────────────── */

function LocationIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3" />
      <path d="M12 19v3" />
      <path d="M2 12h3" />
      <path d="M19 12h3" />
    </svg>
  );
}

function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <line x1="9" y1="7" x2="9" y2="7" />
      <line x1="15" y1="7" x2="15" y2="7" />
      <line x1="9" y1="12" x2="9" y2="12" />
      <line x1="15" y1="12" x2="15" y2="12" />
      <line x1="9" y1="17" x2="15" y2="17" />
    </svg>
  );
}

function PoiIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 21s-7-6.5-7-12a7 7 0 1 1 14 0c0 5.5-7 12-7 12Z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

function WorkflowIcon({ className }: { className?: string }) {
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
      <circle cx="5" cy="6" r="2" />
      <circle cx="5" cy="18" r="2" />
      <path d="M5 8v8" />
      <path d="M9 6h10" />
      <path d="M9 18h10" />
      <path d="M19 8v8a4 4 0 0 1-4 4" />
    </svg>
  );
}

export const workflowView: View = {
  id: "workflow",
  label: "Workflow",
  icon: WorkflowIcon,
  entityTypes: "*",
  defaultDock: "left",
  component: WorkflowViewComponent,
};
