import { expandRecurringEvent, sync } from "node-ical";

/**
 * Campus events — pulled from ICS calendar feeds.
 *
 * Feed URLs are stored per-campus in `sceneData.eventFeeds`; the
 * public home page fetches + parses them server-side (Next caches
 * the fetch) and shows what's upcoming. ICS is the reliable spine —
 * Google Calendar / Outlook OAuth and Facebook are deferred.
 */
export interface CampusEvent {
  id: string;
  title: string;
  /** ISO start. */
  start: string;
  /** ISO end. */
  end: string;
  allDay: boolean;
  location?: string;
}

/** How far ahead to surface events, and how many to show. */
const HORIZON_DAYS = 60;
const MAX_EVENTS = 12;
/** Per-feed fetch timeout — a slow feed must not hang the page. */
const FEED_TIMEOUT_MS = 8000;

/** Read a campus's ICS feed URLs from its `sceneData`. */
export function readEventFeeds(sceneData: unknown): string[] {
  const raw = (sceneData as { eventFeeds?: unknown } | null | undefined)
    ?.eventFeeds;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (u): u is string => typeof u === "string" && u.length > 0,
  );
}

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

/** Format an event's start for display. */
export function formatEventWhen(startIso: string, allDay: boolean): string {
  const date = new Date(startIso);
  if (Number.isNaN(date.getTime())) return "";
  const datePart = date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  if (allDay) return datePart;
  const timePart = date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${datePart} · ${timePart}`;
}
