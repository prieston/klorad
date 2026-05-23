"use client";

import { useEffect, useState } from "react";
import { translate, type Locale } from "@/app/lib/i18n-core";

const STORAGE_KEY = "mappedin:welcome-seen";

/**
 * First-visit coachmark for the public MappedIn viewer.
 *
 * A small overlay card with three concrete tips (search, tap,
 * pan/zoom) so a visitor's first encounter with the map isn't a
 * blank "what do I do." Dismissed once, never shown again (per
 * browser, via localStorage). Opt-in: only the public map mounts
 * it; the dashboard's Indoor tab doesn't.
 */
export function WelcomeOverlay({ locale }: { locale: Locale }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(STORAGE_KEY) === "1") return;
    setShow(true);
  }, []);

  if (!show) return null;

  const t = (key: Parameters<typeof translate>[1]) =>
    translate(locale, key);
  const dismiss = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, "1");
    }
    setShow(false);
  };

  return (
    <div className="pointer-events-auto absolute bottom-20 left-1/2 z-20 w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-solid border-line-soft bg-surface-1/95 p-4 shadow-glass backdrop-blur">
      <h3 className="text-sm font-semibold text-text-primary">
        {t("mappedin.welcomeTitle")}
      </h3>
      <ul className="mt-2 space-y-1.5 text-xs text-text-secondary">
        <li className="flex gap-2">
          <span aria-hidden>🔍</span>
          <span>{t("mappedin.welcomeTipSearch")}</span>
        </li>
        <li className="flex gap-2">
          <span aria-hidden>👆</span>
          <span>{t("mappedin.welcomeTipTap")}</span>
        </li>
        <li className="flex gap-2">
          <span aria-hidden>🧭</span>
          <span>{t("mappedin.welcomeTipExplore")}</span>
        </li>
      </ul>
      <button
        type="button"
        onClick={dismiss}
        className="mt-3 w-full rounded-full bg-accent px-4 py-2 text-xs font-semibold text-accent-contrast transition-opacity hover:opacity-90"
      >
        {t("mappedin.welcomeGotIt")}
      </button>
    </div>
  );
}
