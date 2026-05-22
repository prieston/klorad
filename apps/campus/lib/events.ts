/**
 * Campus events — client-safe helpers and types.
 *
 * This module is import-safe from client components (it has no Node
 * dependencies). The actual ICS fetching + parsing — which pulls in
 * `node-ical` and Node built-ins — lives in `events-server.ts` and
 * must only be imported from server code.
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

/** Read a campus's ICS feed URLs from its `sceneData`. */
export function readEventFeeds(sceneData: unknown): string[] {
  const raw = (sceneData as { eventFeeds?: unknown } | null | undefined)
    ?.eventFeeds;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (u): u is string => typeof u === "string" && u.length > 0,
  );
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
