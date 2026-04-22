"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Locale = "en" | "el";
export const LOCALES: Locale[] = ["en", "el"];
export const DEFAULT_LOCALE: Locale = "en";

const STORAGE_KEY = "campus:locale";

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
    "search.noResults": 'No match for "{query}". Try a building, department, or room.',
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
  },
} as const;

export type MessageKey = keyof typeof MESSAGES.en;

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function detectLocale(urlParam?: string | null): Locale {
  if (urlParam === "el" || urlParam === "en") return urlParam;
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "el" || stored === "en") return stored;
    const nav = window.navigator.language?.toLowerCase() ?? "";
    if (nav.startsWith("el")) return "el";
  }
  return DEFAULT_LOCALE;
}

export function LocaleProvider({
  initial,
  children,
}: {
  initial: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocale] = useState<Locale>(initial);
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, locale);
    }
  }, [locale]);
  const value = useMemo(() => ({ locale, setLocale }), [locale]);
  return (
    <LocaleContext.Provider value={value.locale}>
      <LocaleSetterContext.Provider value={value.setLocale}>
        {children}
      </LocaleSetterContext.Provider>
    </LocaleContext.Provider>
  );
}

const LocaleSetterContext = createContext<(l: Locale) => void>(() => {});

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

export function useSetLocale(): (l: Locale) => void {
  return useContext(LocaleSetterContext);
}

/** Message lookup with {placeholder} substitution. */
export function translate(
  locale: Locale,
  key: MessageKey,
  vars?: Record<string, string | number>
): string {
  const raw = MESSAGES[locale]?.[key] ?? MESSAGES[DEFAULT_LOCALE][key] ?? key;
  if (!vars) return raw;
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replace(new RegExp(`\\{${k}\\}`, "g"), String(v)),
    raw
  );
}

/** Hook form — returns a bound translator for the current locale. */
export function useT(): (key: MessageKey, vars?: Record<string, string | number>) => string {
  const locale = useLocale();
  return useMemo(() => (k, vars) => translate(locale, k, vars), [locale]);
}
