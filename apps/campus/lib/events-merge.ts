/**
 * Merge DB-backed `EventPost` rows with ICS-feed events into one
 * `ConsumerEvent[]` for the public surfaces.
 *
 * ICS-sourced events get sensible defaults — teal calendar banner,
 * `location` → single free-text anchor, no expectedAttendance. The
 * id keeps the `feedUrl::isoStart` shape from `events-server.ts`,
 * which is how the consumer surfaces decide whether the card links
 * to a detail page (DB rows) or to the map (`hasDetail = !id.includes("::")`).
 */
import type { CampusEvent } from "@/lib/events";
import type { EventPost } from "@/lib/events-db";
import type { ConsumerEvent } from "@/lib/consumer/types";

/** True for DB rows; false for ICS-feed rows. */
export function eventHasDetailPage(id: string): boolean {
  return !id.includes("::");
}

/** Convert a stored `EventPost` row to the consumer card shape. */
export function eventPostToConsumer(e: EventPost): ConsumerEvent {
  return {
    id: e.id,
    title: e.title,
    blurb:
      e.description.length > 200
        ? `${e.description.slice(0, 197)}…`
        : e.description,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    bannerColor: e.bannerColor,
    bannerIcon: e.bannerIcon,
    anchors: e.anchors.map((a) => ({
      kind: a.kind,
      refId: a.refId,
      refName: a.refName,
    })),
    expectedAttendance: e.expectedAttendance ?? undefined,
  };
}

/** Convert an ICS-sourced event to the consumer card shape. */
export function icsToConsumer(e: CampusEvent): ConsumerEvent {
  return {
    id: e.id,
    title: e.title,
    blurb: e.location ?? "",
    startsAt: e.start,
    endsAt: e.end,
    bannerColor: "teal",
    bannerIcon: "calendar",
    anchors: e.location
      ? [{ kind: "building", refId: "", refName: e.location }]
      : [],
  };
}

/**
 * Merge + sort the two sources. Future events first, then ongoing,
 * then past — soonest to latest within each group. Caps at `limit`.
 */
export function mergeEvents(
  db: EventPost[],
  ics: CampusEvent[],
  limit = 50,
): ConsumerEvent[] {
  const all = [...db.map(eventPostToConsumer), ...ics.map(icsToConsumer)];
  // Drop dupes that show up in both sources (same title + same minute).
  const seen = new Set<string>();
  const deduped = all.filter((e) => {
    const key = `${e.title.toLowerCase()}|${e.startsAt.slice(0, 16)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return deduped
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
    .slice(0, limit);
}
