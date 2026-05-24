"use client";

import { translate, type Locale } from "@/app/lib/i18n-core";
import { SearchControls } from "./SearchControls";
import type { SpaceOption } from "./WayfindingControls";

export interface ExploreTabProps {
  locale: Locale;
  spaces: SpaceOption[];
  onSearchSelect: (id: string) => void;
  selectedSpace: { id: string; name: string } | null;
  onClearSelection: () => void;
}

/**
 * Explore tab content — search + categories + the currently
 * selected space. Bare versions of the controls (no floating-card
 * chrome) since the surrounding side panel is the chrome.
 */
export function ExploreTab({
  locale,
  spaces,
  onSearchSelect,
  selectedSpace,
  onClearSelection,
}: ExploreTabProps) {
  return (
    <div className="space-y-4">
      <SearchControls
        spaces={spaces}
        onSelect={onSearchSelect}
        locale={locale}
        bare
      />

      {selectedSpace ? (
        <div className="flex items-center gap-3 rounded-xl bg-accent-soft px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-accent">
            {selectedSpace.name}
          </span>
          <button
            type="button"
            onClick={onClearSelection}
            aria-label={translate(locale, "mappedin.clearSelection")}
            className="shrink-0 text-sm leading-none text-accent transition-opacity hover:opacity-70"
          >
            ✕
          </button>
        </div>
      ) : null}
    </div>
  );
}
