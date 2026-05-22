/**
 * i18n core — locale type, message catalogue, and pure helpers.
 *
 * No `"use client"`: this module is import-safe from server
 * components (the public home page renders translated strings during
 * SSR). The React provider / hooks live in `i18n.tsx`, which
 * re-exports everything here.
 */
export type Locale = "en" | "el";
export const LOCALES: Locale[] = ["en", "el"];
export const DEFAULT_LOCALE: Locale = "en";

const MESSAGES = {
  en: {
    // Generic
    "common.close": "Close",
    "common.clear": "Clear",
    "common.cancel": "Cancel",
    "common.save": "Save",
    "common.back": "Back",

    // Toolbar tooltips
    "toolbar.search": "Search",
    "toolbar.directions": "Directions",
    "toolbar.tour": "Tour",
    "toolbar.layers": "Layers",
    "toolbar.whereAmI": "Where am I",

    // Search panel
    "search.title": "Search Campus",
    "search.placeholder": "Buildings, departments, events…",
    "search.noResults":
      'No match for "{query}". Try a building, department, or room.',
    "search.floor": "Floor",
    "search.happeningNow": "Happening Now",
    "search.happeningSoon": "Happening",
    "search.today": "today at {time}",
    "search.onDay": "{date} at {time}",

    // Wayfinding
    "wayfind.title": "Directions",
    "wayfind.from": "From",
    "wayfind.to": "To",
    "wayfind.pickFrom": "Pick a starting point…",
    "wayfind.pickTo": "Pick a destination…",
    "wayfind.myLocation": "My location",
    "wayfind.locating": "Locating…",
    "wayfind.locationDenied": "Location access denied.",
    "wayfind.locationUnsupported": "Geolocation not supported on this device.",
    "wayfind.mode.standard": "Standard",
    "wayfind.mode.stepFree": "Step-free",
    "wayfind.loading": "Finding route…",
    "wayfind.duration": "Duration",
    "wayfind.distance": "Distance",
    "wayfind.stepFreeCaveat":
      "Step-free routing uses the walking network. Campus-specific stair and elevator data can be added in the Studio to refine this route.",

    // Tour
    "tour.title": "Campus Tour",

    // Branded header default alt
    "branding.logoAlt": "Logo",

    // Public home page
    "home.openMap": "Open map",
    "home.exploreMap": "Explore the campus map",
    "home.events": "Upcoming events",
    "home.news": "News",
    "home.noNews": "No news yet — check back soon.",
    "home.poweredBy": "Powered by Klorad",
  },
  el: {
    // Generic
    "common.close": "Κλείσιμο",
    "common.clear": "Καθαρισμός",
    "common.cancel": "Άκυρο",
    "common.save": "Αποθήκευση",
    "common.back": "Πίσω",

    // Toolbar tooltips
    "toolbar.search": "Αναζήτηση",
    "toolbar.directions": "Οδηγίες",
    "toolbar.tour": "Ξενάγηση",
    "toolbar.layers": "Επίπεδα",
    "toolbar.whereAmI": "Η τοποθεσία μου",

    // Search panel
    "search.title": "Αναζήτηση στην Πανεπιστημιούπολη",
    "search.placeholder": "Κτίρια, τμήματα, εκδηλώσεις…",
    "search.noResults":
      'Δεν βρέθηκε "{query}". Δοκιμάστε ένα κτίριο, τμήμα ή αίθουσα.',
    "search.floor": "Όροφος",
    "search.happeningNow": "Γίνεται Τώρα",
    "search.happeningSoon": "Πρόγραμμα",
    "search.today": "σήμερα στις {time}",
    "search.onDay": "{date} στις {time}",

    // Wayfinding
    "wayfind.title": "Οδηγίες",
    "wayfind.from": "Από",
    "wayfind.to": "Προς",
    "wayfind.pickFrom": "Επιλέξτε αφετηρία…",
    "wayfind.pickTo": "Επιλέξτε προορισμό…",
    "wayfind.myLocation": "Η τοποθεσία μου",
    "wayfind.locating": "Εντοπισμός…",
    "wayfind.locationDenied": "Δεν επιτρέπεται η πρόσβαση στην τοποθεσία.",
    "wayfind.locationUnsupported": "Ο εντοπισμός τοποθεσίας δεν υποστηρίζεται.",
    "wayfind.mode.standard": "Κανονικό",
    "wayfind.mode.stepFree": "Προσβάσιμο",
    "wayfind.loading": "Υπολογισμός διαδρομής…",
    "wayfind.duration": "Διάρκεια",
    "wayfind.distance": "Απόσταση",
    "wayfind.stepFreeCaveat":
      "Η προσβάσιμη διαδρομή χρησιμοποιεί το δίκτυο πεζών. Δεδομένα για σκάλες και ανελκυστήρες μπορούν να προστεθούν στο Studio για ακρίβεια.",

    // Tour
    "tour.title": "Ξενάγηση Πανεπιστημιούπολης",

    // Branded header default alt
    "branding.logoAlt": "Λογότυπο",

    // Public home page
    "home.openMap": "Άνοιγμα χάρτη",
    "home.exploreMap": "Εξερευνήστε τον χάρτη",
    "home.events": "Προσεχείς εκδηλώσεις",
    "home.news": "Νέα",
    "home.noNews": "Δεν υπάρχουν νέα ακόμη — ελάτε σύντομα ξανά.",
    "home.poweredBy": "Με την υποστήριξη του Klorad",
  },
} as const;

export type MessageKey = keyof typeof MESSAGES.en;

/**
 * URL-only locale detection. Browser-side preferences (localStorage,
 * navigator.language) are intentionally NOT consulted here — they make
 * the SSR pass disagree with the first client render and trigger React
 * hydration warnings.
 */
export function detectLocale(urlParam?: string | null): Locale {
  if (urlParam === "el" || urlParam === "en") return urlParam;
  return DEFAULT_LOCALE;
}

/** Message lookup with {placeholder} substitution. */
export function translate(
  locale: Locale,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  const raw = MESSAGES[locale]?.[key] ?? MESSAGES[DEFAULT_LOCALE][key] ?? key;
  if (!vars) return raw;
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replace(new RegExp(`\\{${k}\\}`, "g"), String(v)),
    raw,
  );
}

/**
 * Campus-authored text in both languages. Stored on news posts, home
 * page config, etc. A plain `string` is also accepted — legacy
 * single-language content reads fine via {@link pickText}.
 */
export interface LocalizedText {
  en?: string;
  el?: string;
}

/** A field that is either localized text or a legacy plain string. */
export type Localizable = string | LocalizedText;

/**
 * Resolve a {@link Localizable} for a locale: the requested language,
 * else the other language, else empty. So a post written only in
 * Greek still shows (its Greek) to an English visitor.
 */
export function pickText(
  value: Localizable | null | undefined,
  locale: Locale,
): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value[locale] || value.en || value.el || "";
}
