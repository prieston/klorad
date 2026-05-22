import { expandRecurringEvent, sync } from "node-ical";
import type { CampusEvent } from "./events";

/**
 * Campus events — server-only ICS fetching + parsing.
 *
 * Pulls in `node-ical` (and Node built-ins like `node:crypto`), so
 * this module must only be imported from server code (the public
 * home page). Client code uses `events.ts` instead — importing this
 * from a client component breaks the build (`node:crypto` can't be
 * bundled for the browser).
 */

/** How far ahead to surface events, and how many to show. */
const HORIZON_DAYS = 60;
const MAX_EVENTS = 12;
/** Per-feed fetch timeout — a slow feed must not hang the page. */
const FEED_TIMEOUT_MS = 8000;

/** ICS string values can be plain or `{ params, val }` — flatten them. */
function text(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "val" in value) {
    const v = (value as { val?: unknown }).val;
    return typeof v === "string" ? v : "";
  }
  return "";
}

/**
 * Fetch + parse the given ICS feeds and return upcoming events,
 * soonest first. Recurring events are expanded; a bad or slow feed
 * is skipped so the rest still render.
 */
export async function fetchCampusEvents(
  feedUrls: string[],
): Promise<CampusEvent[]> {
  const now = new Date();
  const horizon = new Date(now.getTime() + HORIZON_DAYS * 86_400_000);
  const events: CampusEvent[] = [];

  for (const url of feedUrls) {
    try {
      const res = await fetch(url, {
        next: { revalidate: 1800 },
        signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
      });
      if (!res.ok) continue;
      const parsed = sync.parseICS(await res.text());

      for (const key of Object.keys(parsed)) {
        const component = parsed[key];
        if (!component || component.type !== "VEVENT") continue;
        for (const instance of expandRecurringEvent(component, {
          from: now,
          to: horizon,
        })) {
          const start = new Date(instance.start);
          events.push({
            id: `${key}::${start.toISOString()}`,
            title: text(instance.summary) || "Event",
            start: start.toISOString(),
            end: new Date(instance.end).toISOString(),
            allDay: instance.isFullDay,
            location: text(instance.event.location) || undefined,
          });
        }
      }
    } catch {
      // Skip an unreachable / malformed feed — others still render.
    }
  }

  return events
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
    .slice(0, MAX_EVENTS);
}
