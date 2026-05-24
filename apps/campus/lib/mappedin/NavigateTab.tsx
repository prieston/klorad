"use client";

import { WayfindingControls, type SpaceOption } from "./WayfindingControls";
import type { Locale } from "@/app/lib/i18n-core";

export interface NavigateTabProps {
  locale: Locale;
  spaces: SpaceOption[];
  routing: boolean;
  routeError: string | null;
  routeSummary: string | null;
  routeInstructions: string[];
  onRoute: (from: string, to: string, accessible: boolean) => void;
  onClearRoute: () => void;
}

/**
 * Navigate tab content — wayfinding (From / To / step-free /
 * summary / turn-by-turn). The chat assistant lands here in a
 * follow-up commit.
 */
export function NavigateTab({
  locale,
  spaces,
  routing,
  routeError,
  routeSummary,
  routeInstructions,
  onRoute,
  onClearRoute,
}: NavigateTabProps) {
  return (
    <div className="space-y-4">
      <WayfindingControls
        spaces={spaces}
        routing={routing}
        error={routeError}
        summary={routeSummary}
        instructions={routeInstructions}
        onRoute={onRoute}
        onClear={onClearRoute}
        locale={locale}
        bare
      />
    </div>
  );
}
