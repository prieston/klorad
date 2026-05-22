"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_LOCALE,
  type Locale,
  type MessageKey,
  translate,
} from "./i18n-core";

// Re-export the server-safe core so existing `@/app/lib/i18n` imports
// (the viewer and its components) keep working unchanged.
export * from "./i18n-core";

const STORAGE_KEY = "campus:locale";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);
const LocaleSetterContext = createContext<(l: Locale) => void>(() => {});

export function LocaleProvider({
  initial,
  children,
}: {
  initial: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocale] = useState<Locale>(initial);
  // Server renders with `initial` (URL param or DEFAULT_LOCALE) so the
  // markup matches the client's first paint. After mount, upgrade to
  // any stored preference / browser language so returning visitors see
  // their locale immediately.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "el" || stored === "en") {
      if (stored !== initial) setLocale(stored as Locale);
      return;
    }
    const nav = window.navigator.language?.toLowerCase() ?? "";
    if (nav.startsWith("el") && initial !== "el") setLocale("el");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

export function useSetLocale(): (l: Locale) => void {
  return useContext(LocaleSetterContext);
}

/** Hook form — returns a bound translator for the current locale. */
export function useT(): (
  key: MessageKey,
  vars?: Record<string, string | number>,
) => string {
  const locale = useLocale();
  return useMemo(() => (k, vars) => translate(locale, k, vars), [locale]);
}
