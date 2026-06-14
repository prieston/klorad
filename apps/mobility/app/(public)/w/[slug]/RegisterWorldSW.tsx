"use client";

import { useEffect } from "react";

/**
 * Registers `/sw-worlds.js` with scope `/w/<slug>/` so the world's
 * PWA is installable + offline-capable, and a future push opt-in (PR3)
 * binds to a subscription scoped to *this* world only.
 *
 * The same SW file backs every world — the browser dedupes
 * registrations by scope, so each world ends up with its own
 * registration record + cache namespace. Skipped in development
 * (HMR replaces modules, the SW would steal the page) and on
 * browsers without service workers.
 */
export function RegisterWorldSW({ slug }: { slug: string }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;
    const scope = `/w/${slug}/`;
    navigator.serviceWorker
      .register("/sw-worlds.js", { scope })
      .catch(() => {
        // Registration failures are non-fatal — the world still works,
        // it just won't be installable / offline-capable for this
        // visit. Browser console carries the real reason.
      });
  }, [slug]);

  return null;
}
