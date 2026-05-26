"use client";

import { WayfindingControls, type SpaceOption } from "./WayfindingControls";
import { AssistantChat } from "./AssistantChat";
import { translate, type Locale } from "@/app/lib/i18n-core";

export interface NavigateTabProps {
  locale: Locale;
  spaces: SpaceOption[];
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
 * Accessibility routing isn't a top-level UI control here: the chat
 * detects it from the user's wording ("I use a wheelchair…") and
 * forwards `accessible: true` on the route call. Adding a dedicated
 * toggle is one prop away if a deployment wants it back.
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
  onFocus,
  projectId,
  campusName,
}: NavigateTabProps) {
  const t = (key: Parameters<typeof translate>[1]) =>
    translate(locale, key);

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
        spaces={spaces}
        onFocus={onFocus}
        onRoute={onRoute}
        projectId={projectId}
        campusName={campusName}
      />
    </div>
  );
}
