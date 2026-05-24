"use client";

import { useState } from "react";
import { cn } from "@klorad/design-system";
import { translate, type Locale } from "@/app/lib/i18n-core";
import { ExploreTab } from "./ExploreTab";
import { NavigateTab } from "./NavigateTab";
import { FloorControls, type FloorOption } from "./FloorControls";
import type { SpaceOption } from "./WayfindingControls";

type Tab = "explore" | "navigate";

export interface SidePanelProps {
  locale: Locale;
  // Floor / building (shared, rendered in the header above the tabs)
  floors: FloorOption[];
  currentFloorId: string;
  buildings: FloorOption[];
  currentBuildingId: string;
  onSelectFloor: (id: string) => void;
  onSelectBuilding: (id: string) => void;
  // Explore
  spaces: SpaceOption[];
  onSearchSelect: (id: string) => void;
  selectedSpace: { id: string; name: string } | null;
  onClearSelection: () => void;
  // Navigate
  routing: boolean;
  routeError: string | null;
  routeSummary: string | null;
  routeInstructions: string[];
  onRoute: (from: string, to: string, accessible: boolean) => void;
  onClearRoute: () => void;
}

/**
 * Left side panel for the MappedIn viewer — replaces the older
 * stack of floating cards (search / wayfinding / floors / selection)
 * with one top-to-bottom panel that lives outside the map area.
 *
 * Structure:
 *   - Context header (building + floor pickers, only when relevant)
 *   - Explore | Navigate tabs
 *   - Tab content
 */
export function SidePanel(props: SidePanelProps) {
  const [tab, setTab] = useState<Tab>("explore");
  const t = (key: Parameters<typeof translate>[1]) =>
    translate(props.locale, key);

  const hasContext =
    props.floors.length > 1 || props.buildings.length > 1;

  return (
    <div className="flex h-full flex-col bg-surface-1">
      {hasContext ? (
        <div className="border-b border-solid border-line-soft px-4 py-3">
          <FloorControls
            floors={props.floors}
            currentFloorId={props.currentFloorId}
            buildings={props.buildings}
            currentBuildingId={props.currentBuildingId}
            onSelectFloor={props.onSelectFloor}
            onSelectBuilding={props.onSelectBuilding}
            locale={props.locale}
            bare
          />
        </div>
      ) : null}

      <div className="flex gap-1 border-b border-solid border-line-soft px-4 py-2">
        <TabButton
          active={tab === "explore"}
          onClick={() => setTab("explore")}
          label={t("mappedin.tabExplore")}
        />
        <TabButton
          active={tab === "navigate"}
          onClick={() => setTab("navigate")}
          label={t("mappedin.tabNavigate")}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === "explore" ? (
          <ExploreTab
            locale={props.locale}
            spaces={props.spaces}
            onSearchSelect={props.onSearchSelect}
            selectedSpace={props.selectedSpace}
            onClearSelection={props.onClearSelection}
          />
        ) : (
          <NavigateTab
            locale={props.locale}
            spaces={props.spaces}
            routing={props.routing}
            routeError={props.routeError}
            routeSummary={props.routeSummary}
            routeInstructions={props.routeInstructions}
            onRoute={props.onRoute}
            onClearRoute={props.onClearRoute}
            onFocus={props.onSearchSelect}
          />
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
        active
          ? "bg-accent text-accent-contrast"
          : "text-text-secondary hover:bg-accent-soft hover:text-accent",
      )}
    >
      {label}
    </button>
  );
}
