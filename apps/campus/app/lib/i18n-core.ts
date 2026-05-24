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

    // MappedIn indoor / campus viewer
    "mappedin.loading": "Loading the campus map…",
    "mappedin.errorTitle": "We couldn’t load the campus map",
    "mappedin.errorBody": "Please refresh the page or try again later.",
    "mappedin.searchPlaceholder": "Find a room or space…",
    "mappedin.searchClear": "Clear search",
    "mappedin.searchNoMatch": "Nothing matches “{query}”.",
    "mappedin.wayfindTitle": "Indoor directions",
    "mappedin.wayfindFrom": "From",
    "mappedin.wayfindTo": "To",
    "mappedin.wayfindPick": "Choose a space…",
    "mappedin.wayfindStepFree": "Step-free route",
    "mappedin.wayfindGo": "Get directions",
    "mappedin.wayfindRouting": "Routing…",
    "mappedin.wayfindClear": "Clear",
    "mappedin.wayfindNoRoute": "No route between those spaces.",
    "mappedin.wayfindNoStepFree":
      "No step-free route between those spaces.",
    "mappedin.wayfindFailed": "We couldn’t compute that route.",
    "mappedin.clearSelection": "Clear selection",
    "mappedin.building": "Building",
    "mappedin.errorBack": "Back to home",
    "mappedin.welcomeTitle": "Quick tips",
    "mappedin.welcomeTipSearch":
      "Search or pick a category to find a room.",
    "mappedin.welcomeTipTap": "Tap a space to see its details.",
    "mappedin.welcomeTipExplore": "Drag and pinch to look around.",
    "mappedin.welcomeGotIt": "Got it",
    "mappedin.tabExplore": "Explore",
    "mappedin.tabNavigate": "Navigate",
    "mappedin.pickRoom": "Pick a starting room and a destination.",
    "mappedin.profile": "Profile",
    "mappedin.profileDefault": "Default",
    "mappedin.profileWheelchair": "Wheelchair",
    "mappedin.profileVisual": "Visually impaired",
    "mappedin.swap": "Swap",

    // Unpublished / not-found states
    "published.body":
      "This campus isn’t published yet. The author is still building it — check back soon.",
    "notFound.title": "Campus not found",
    "notFound.body":
      "The link you followed may be wrong, or this campus no longer exists.",
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

    // MappedIn indoor / campus viewer
    "mappedin.loading": "Φόρτωση του χάρτη…",
    "mappedin.errorTitle": "Δεν φορτώθηκε ο χάρτης",
    "mappedin.errorBody":
      "Παρακαλώ ανανεώστε τη σελίδα ή δοκιμάστε ξανά αργότερα.",
    "mappedin.searchPlaceholder": "Βρείτε αίθουσα ή χώρο…",
    "mappedin.searchClear": "Καθαρισμός αναζήτησης",
    "mappedin.searchNoMatch": "Δεν βρέθηκε «{query}».",
    "mappedin.wayfindTitle": "Οδηγίες εσωτερικά",
    "mappedin.wayfindFrom": "Από",
    "mappedin.wayfindTo": "Προς",
    "mappedin.wayfindPick": "Επιλέξτε χώρο…",
    "mappedin.wayfindStepFree": "Προσβάσιμη διαδρομή",
    "mappedin.wayfindGo": "Οδηγίες",
    "mappedin.wayfindRouting": "Υπολογισμός…",
    "mappedin.wayfindClear": "Καθαρισμός",
    "mappedin.wayfindNoRoute": "Δεν υπάρχει διαδρομή ανάμεσα στους χώρους.",
    "mappedin.wayfindNoStepFree":
      "Δεν υπάρχει προσβάσιμη διαδρομή ανάμεσα στους χώρους.",
    "mappedin.wayfindFailed": "Δεν υπολογίστηκε η διαδρομή.",
    "mappedin.clearSelection": "Καθαρισμός επιλογής",
    "mappedin.building": "Κτίριο",
    "mappedin.errorBack": "Πίσω στην αρχική",
    "mappedin.welcomeTitle": "Γρήγορες συμβουλές",
    "mappedin.welcomeTipSearch":
      "Αναζητήστε ή επιλέξτε κατηγορία για να βρείτε αίθουσα.",
    "mappedin.welcomeTipTap": "Αγγίξτε έναν χώρο για λεπτομέρειες.",
    "mappedin.welcomeTipExplore": "Σύρετε και ζουμάρετε για να εξερευνήσετε.",
    "mappedin.welcomeGotIt": "Εντάξει",
    "mappedin.tabExplore": "Εξερεύνηση",
    "mappedin.tabNavigate": "Πλοήγηση",
    "mappedin.pickRoom": "Επιλέξτε αφετηρία και προορισμό.",
    "mappedin.profile": "Προφίλ",
    "mappedin.profileDefault": "Κανονική",
    "mappedin.profileWheelchair": "Αναπηρικό αμαξίδιο",
    "mappedin.profileVisual": "Πρόβλημα όρασης",
    "mappedin.swap": "Εναλλαγή",

    // Unpublished / not-found states
    "published.body":
      "Η σελίδα της πανεπιστημιούπολης δεν έχει δημοσιευτεί ακόμη — επιστρέψτε σύντομα.",
    "notFound.title": "Δεν βρέθηκε η πανεπιστημιούπολη",
    "notFound.body":
      "Ο σύνδεσμος μπορεί να είναι λανθασμένος ή η πανεπιστημιούπολη να μην υπάρχει πια.",
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
  // Function form — replacement strings with `$&` / `$1` / `$$`
  // (e.g. user-typed text in a search query) would otherwise be
  // interpreted by String.prototype.replace as regex backreferences.
  return Object.entries(vars).reduce(
    (acc, [k, v]) =>
      acc.replace(new RegExp(`\\{${k}\\}`, "g"), () => String(v)),
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
