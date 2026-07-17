"use client";

import { AssistantPanel } from "@klorad/design-system";
import type { AssistantAction } from "@/lib/assistant/tools";
import { KlioSourceCards } from "./KlioSourceCards";

export interface KlioPanelProps {
  /** Project id — every assistant call is scoped to this campus. */
  mapId: string;
  /** Campus display name — fed to the system prompt + hello copy. */
  campusName: string;
  /** UI locale — drives all visible strings + the assistant locale param. */
  locale: "en" | "el";
  /** Rector-defined suggestion chips. Empty array = use the platform
   *  defaults. Resolved server-side from `sceneData.klio.chips`. */
  chipOverrides?: Array<{
    en: { label: string; prompt: string };
    el?: { label: string; prompt: string };
  }>;
  /**
   * Deprecated — `KlioSourceCards` builds map URLs from `mapId` +
   * locale directly. Kept on the props for one release so the
   * existing call site doesn't break; can be dropped after.
   */
  mapHref?: string;
}

interface Suggestion {
  label: string;
  prompt: string;
}

const COPY = {
  en: {
    hi: "Hi, I'm Klio.",
    sub: "Ask me where things are, opening hours, what's on, or for a route.",
    placeholder: "Ask anything about campus…",
    suggestions: [
      { label: "Where's the gym?", prompt: "Where's the gym?" },
      { label: "Events this week", prompt: "What events are happening this week?" },
      {
        label: "Step-free route to the Library",
        prompt: "Give me a step-free route to the Library.",
      },
      { label: "What's for lunch?", prompt: "What's available for lunch today?" },
    ] satisfies Suggestion[],
    poweredBy: "Powered by Claude · Klorad",
    unavailable: "Sorry — Klio is unavailable right now.",
  },
  el: {
    hi: "Γεια, είμαι η Κλειώ.",
    sub: "Ρωτήστε με πού βρίσκονται τα μέρη, ωράρια, εκδηλώσεις ή ζητήστε διαδρομή.",
    placeholder: "Ρωτήστε ό,τι θέλετε για την πανεπιστημιούπολη…",
    suggestions: [
      { label: "Πού είναι το γυμναστήριο;", prompt: "Πού είναι το γυμναστήριο;" },
      { label: "Εκδηλώσεις αυτή την εβδομάδα", prompt: "Ποιες εκδηλώσεις γίνονται αυτή την εβδομάδα;" },
      {
        label: "Προσβάσιμη διαδρομή στη Βιβλιοθήκη",
        prompt: "Δώσε μου προσβάσιμη διαδρομή προς τη Βιβλιοθήκη.",
      },
      { label: "Τι έχει για μεσημεριανό;", prompt: "Τι έχει για μεσημεριανό σήμερα;" },
    ] satisfies Suggestion[],
    poweredBy: "Με τη βοήθεια του Claude · Klorad",
    unavailable: "Συγγνώμη — η Κλειώ δεν είναι διαθέσιμη αυτή τη στιγμή.",
  },
} as const;

/**
 * Klio — the campus assistant's home tab. Now a thin wrapper around
 * the DS `AssistantPanel` primitive: this file owns the Campus
 * copy (bilingual EN/EL), rector chip overrides, `AssistantAction`
 * → `KlioSourceCards` renderer, and the `/api/assistant` backend
 * URL. The DS primitive owns everything else (chat thread, hero
 * state, sticky input, streaming).
 */
export function KlioPanel({
  mapId,
  campusName,
  locale,
  chipOverrides,
}: KlioPanelProps) {
  const copy = COPY[locale];
  const suggestions: Suggestion[] =
    chipOverrides && chipOverrides.length > 0
      ? chipOverrides.map((c) => {
          const loc = locale === "el" ? c.el ?? c.en : c.en;
          return { label: loc.label, prompt: loc.prompt };
        })
      : [...copy.suggestions];

  return (
    <AssistantPanel<AssistantAction>
      endpoint="/api/assistant"
      extraBody={{ mapId, campusName, locale }}
      heroTitle={copy.hi}
      heroSubtitle={copy.sub}
      suggestions={suggestions}
      placeholder={copy.placeholder}
      poweredByLabel={copy.poweredBy}
      unavailableCopy={copy.unavailable}
      renderActions={(actions) => (
        <KlioSourceCards actions={actions} mapId={mapId} locale={locale} />
      )}
    />
  );
}
