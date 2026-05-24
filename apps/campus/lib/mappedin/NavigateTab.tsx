"use client";

import { useState } from "react";
import { cn } from "@klorad/design-system";
import { WayfindingControls, type SpaceOption } from "./WayfindingControls";
import { translate, type Locale } from "@/app/lib/i18n-core";

type Profile = "default" | "wheelchair" | "visual";

const PROFILE_LABEL_KEY = {
  default: "mappedin.profileDefault",
  wheelchair: "mappedin.profileWheelchair",
  visual: "mappedin.profileVisual",
} as const;

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
 * Navigate tab — routing profile (Default / Wheelchair / Visually
 * impaired), From / To with Swap + Clear, and the route summary /
 * turn-by-turn instructions. The profile maps to MappedIn's
 * step-free routing (wheelchair + visual both request accessible).
 * The AI chat assistant lands here in a follow-up commit.
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
  const [profile, setProfile] = useState<Profile>("default");
  const accessible = profile !== "default";
  const t = (key: Parameters<typeof translate>[1]) =>
    translate(locale, key);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">
          {t("mappedin.profile")}
        </p>
        <div className="mt-2 grid gap-1">
          {(["default", "wheelchair", "visual"] as const).map((p) => {
            const active = profile === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setProfile(p)}
                aria-pressed={active}
                className={cn(
                  "rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors",
                  active
                    ? "bg-accent-soft text-accent"
                    : "bg-surface-2 text-text-secondary hover:bg-accent-soft hover:text-accent",
                )}
              >
                {translate(locale, PROFILE_LABEL_KEY[p])}
              </button>
            );
          })}
        </div>
      </div>

      <WayfindingControls
        spaces={spaces}
        routing={routing}
        error={routeError}
        summary={routeSummary}
        instructions={routeInstructions}
        onRoute={onRoute}
        onClear={onClearRoute}
        locale={locale}
        accessible={accessible}
        bare
      />
    </div>
  );
}
