"use client";

import { useEffect, useRef } from "react";

/**
 * Reports one view, once, after the page has mounted.
 *
 * Renders nothing. The `useRef` guard matters more than it looks: React's
 * development strict mode mounts effects twice, and without it every local
 * page load would be counted as two — which is the kind of thing that gets
 * noticed only after someone quotes the number in a board report.
 *
 * `keepalive` so the request survives the visitor navigating away
 * immediately, which is precisely the case a bounce-heavy embed produces.
 * Failures are swallowed: a counter is never worth a console error on a
 * museum's page.
 */
export function ViewBeacon({
  venueSlug,
  kind,
  targetSlug,
  isEmbed = false,
  language,
}: {
  venueSlug: string;
  kind: "venue" | "scene" | "object" | "tour";
  targetSlug?: string;
  isEmbed?: boolean;
  language?: string;
}) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;

    void fetch("/api/events/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ venueSlug, kind, targetSlug, isEmbed, language }),
    }).catch(() => {});
  }, [venueSlug, kind, targetSlug, isEmbed, language]);

  return null;
}
