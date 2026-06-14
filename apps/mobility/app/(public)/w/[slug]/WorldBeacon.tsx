"use client";

import { useEffect } from "react";

/**
 * Anonymous analytics beacon for the public world.
 *
 *   - Fires a `view` event on mount, deduped against `sessionStorage`
 *     so a single tab refresh doesn't double-count.
 *   - Listens for the `appinstalled` event and fires an `install`
 *     event when it lands.
 *
 * `anonId` is a per-browser opaque UUID held in `localStorage`. We
 * never look up the visitor from it — it exists only so the operator
 * panel can count uniques without a server-side cookie.
 */
export function WorldBeacon({ slug }: { slug: string }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    let anonId: string;
    try {
      anonId = window.localStorage.getItem("klorad-mobility-anon") ?? "";
      if (!anonId) {
        anonId = generateAnonId();
        window.localStorage.setItem("klorad-mobility-anon", anonId);
      }
    } catch {
      anonId = generateAnonId();
    }

    // View — dedupe per tab session so reload doesn't inflate the
    // count. Distinct tabs still each count as one view.
    try {
      const key = `klorad-mobility-view:${slug}`;
      if (sessionStorage.getItem(key) !== "1") {
        sessionStorage.setItem(key, "1");
        void fire(slug, "view", anonId);
      }
    } catch {
      void fire(slug, "view", anonId);
    }

    const onInstall = () => {
      void fire(slug, "install", anonId);
    };
    window.addEventListener("appinstalled", onInstall);
    return () => window.removeEventListener("appinstalled", onInstall);
  }, [slug]);

  return null;
}

async function fire(slug: string, kind: "view" | "install", anonId: string) {
  try {
    await fetch(`/api/public/worlds/${slug}/event`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, anonId }),
      // `keepalive` lets the request finish if the user navigates
      // away mid-beacon (the install event is racy with the PWA's
      // installed window stealing focus).
      keepalive: true,
    });
  } catch {
    /* beacons are best-effort */
  }
}

function generateAnonId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Tiny fallback for ancient browsers — non-cryptographic but
  // dedupe-only, so collisions cost an undercount, not a leak.
  return Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join("");
}
