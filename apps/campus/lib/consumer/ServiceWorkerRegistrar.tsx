"use client";

import { useEffect } from "react";

/**
 * Registers `/sw.js` on every campus public page so the visitor's
 * very first navigation installs the PWA shell — offline fallback,
 * route caching, push delivery — without waiting for a
 * "Get notifications" tap.
 *
 * Renders nothing. Idempotent: the browser dedupes registrations by
 * scope, so re-registering on each page mount is a cheap no-op.
 * Skipped in development and on browsers without service workers.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Next swaps modules around during HMR; the SW would steal the
    // page out from under it. Only register on real loads.
    if (process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration failures are non-fatal — the app still works,
      // it just won't be installable / offline-capable for this
      // visit. Browsers log the actual cause to the console for us.
    });
  }, []);

  return null;
}
