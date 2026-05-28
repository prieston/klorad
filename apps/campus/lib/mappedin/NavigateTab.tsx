"use client";

import { useState } from "react";
import { WayfindingControls, type SpaceOption } from "./WayfindingControls";
import { AssistantChat } from "./AssistantChat";
import { translate, type Locale } from "@/app/lib/i18n-core";

export interface NavigateTabProps {
  locale: Locale;
  /** Rooms in the currently selected building. */
  spaces: SpaceOption[];
  /** Every room across every building — used when "show all" is on. */
  allSpaces: SpaceOption[];
  routing: boolean;
  routeError: string | null;
  routeSummary: string | null;
  routeInstructions: string[];
  onRoute: (from: string, to: string, accessible: boolean) => void;
  onClearRoute: () => void;
  /** Focus a single space — used by the assistant for "show me X" intents. */
  onFocus: (spaceId: string) => void;
  /** Project id — passed to AssistantChat for content tool calls. */
  projectId?: string;
  /** Campus display name — passed to AssistantChat for the system prompt. */
  campusName?: string;
}

/**
 * Navigate tab — From / To pickers with Swap + Clear, the route
 * summary / turn-by-turn instructions, and the ask-the-assistant
 * chat below a divider.
 *
 * Cross-building wayfinding: the From / To dropdowns default to the
 * current building's rooms only, but a "Show all buildings" toggle
 * sitting above the controls swaps in `allSpaces` so the visitor can
 * route between buildings without first deselecting one. When only
 * one building exists, the toggle is hidden (no point).
 */
export function NavigateTab({
  locale,
  spaces,
  allSpaces,
  routing,
  routeError,
  routeSummary,
  routeInstructions,
  onRoute,
  onClearRoute,
  onFocus,
  projectId,
  campusName,
}: NavigateTabProps) {
  const t = (key: Parameters<typeof translate>[1]) =>
    translate(locale, key);

  const [allBuildings, setAllBuildings] = useState(false);
  // Anything to switch between? If `spaces` already equals `allSpaces`
  // we're either in a single-building venue or no building's filtered
  // — either way the toggle is decoration, hide it.
  const hasMultipleBuildings = allSpaces.length > spaces.length;
  const visibleSpaces = allBuildings ? allSpaces : spaces;

  return (
    <div className="space-y-4">
      {hasMultipleBuildings ? (
        <label className="flex cursor-pointer items-center gap-2 text-xs text-text-secondary">
          <input
            type="checkbox"
            checked={allBuildings}
            onChange={(e) => setAllBuildings(e.target.checked)}
            className="h-3.5 w-3.5 accent-accent"
          />
          {t("mappedin.showAllBuildings")}
          <span className="ml-1 text-text-tertiary">
            ({allSpaces.length} rooms)
          </span>
        </label>
      ) : null}

      <WayfindingControls
        spaces={visibleSpaces}
        routing={routing}
        error={routeError}
        summary={routeSummary}
        instructions={routeInstructions}
        onRoute={onRoute}
        onClear={onClearRoute}
        locale={locale}
        bare
      />

      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center" aria-hidden>
          <div className="w-full border-t border-solid border-line-soft" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-surface-1 px-2 text-[0.65rem] uppercase tracking-wide text-text-tertiary">
            {t("mappedin.askDivider")}
          </span>
        </div>
      </div>

      <AssistantChat
        locale={locale}
        spaces={visibleSpaces}
        onFocus={onFocus}
        onRoute={onRoute}
        projectId={projectId}
        campusName={campusName}
      />
    </div>
  );
}
