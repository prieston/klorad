import "server-only";
import type {
  ActivityActionType,
  ActivityEntityType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ChangeKind =
  | "news"
  | "event"
  | "club"
  | "dining"
  | "campus"
  | "broadcast"
  | "member"
  | "subscribers";

export interface CampusChange {
  /** Stable identifier — `Activity.id` for real audit rows,
   *  `subscribers:<mapId>:7d` for the rolled-up subscriber tally. */
  id: string;
  kind: ChangeKind;
  /** Human-readable label. Audit rows pre-render this on write so
   *  the dashboard can show it verbatim (no second lookup). */
  title: string;
  /** Optional deep-link into the dashboard. */
  href?: string;
  /** Optional secondary context — e.g. `"3 new"` or `"by Maria"`. */
  detail?: string;
  /** True for creations rather than updates. */
  isNew: boolean;
  /** ISO timestamp. */
  at: string;
  /** Display name of the actor (when known). */
  actor?: string;
}

interface BuildOpts {
  mapId: string;
  orgId: string;
  /** How many changes to return after merging. */
  limit?: number;
}

/** Activity window — anything older than this drops off the feed. */
const WINDOW_DAYS = 30;

/**
 * "What changed" feed for the campus dashboard, backed by the
 * `Activity` table. Each write through Campus's API endpoints
 * leaves a row (see `lib/audit.ts`); this function reads them back
 * and shapes them for the UI.
 *
 * Subscriber growth is still synthesised — push subscriptions are
 * anonymous, so we roll them up into a single 7-day tally rather
 * than write one Activity row per device. Same intent as the
 * earlier `updatedAt`-based feed; just narrower scope now that real
 * audit rows carry every other entity.
 */
export async function readCampusChanges({
  mapId,
  orgId,
  limit = 8,
}: BuildOpts): Promise<CampusChange[]> {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const dashBase = `/org/${orgId}/maps/${mapId}`;

  const [rows, recentSubs] = await Promise.all([
    prisma.activity
      .findMany({
        where: { projectId: mapId, createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: limit * 2,
        include: {
          actor: { select: { name: true, email: true } },
        },
      })
      .catch(() => []),
    prisma.pushSubscription
      .count({
        where: {
          projectId: mapId,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      })
      .catch(() => 0),
  ]);

  const items: CampusChange[] = [];

  for (const row of rows) {
    const kind = mapKind(row.entityType);
    if (!kind) continue;
    items.push({
      id: row.id,
      kind,
      title:
        row.message ??
        // Fallback when older rows have no pre-rendered message —
        // synthesise something serviceable so the feed doesn't show
        // a blank row.
        `${humanAction(row.action)} ${humanEntity(row.entityType)}`,
      href: hrefFor(kind, dashBase),
      isNew: isCreation(row.action),
      at: row.createdAt.toISOString(),
      actor:
        row.actor?.name?.trim() ||
        row.actor?.email?.split("@")[0] ||
        undefined,
    });
  }

  // Subscribers: anonymous, no Activity rows — keep the rolled-up
  // tally so a burst of installs still surfaces in the feed.
  if (recentSubs > 0) {
    items.push({
      id: `subscribers:${mapId}:7d`,
      kind: "subscribers",
      title:
        recentSubs === 1
          ? "1 new push subscriber"
          : `${recentSubs} new push subscribers`,
      detail: "last 7 days",
      href: `${dashBase}/reach`,
      isNew: true,
      at: new Date().toISOString(),
    });
  }

  items.sort((a, b) => b.at.localeCompare(a.at));
  return items.slice(0, limit);
}

function isCreation(action: ActivityActionType): boolean {
  return action === "CREATED" || action === "ADDED" || action === "PUBLISHED";
}

/** Map an `ActivityEntityType` to the dashboard's `ChangeKind`. The
 *  enum carries lots of platform values (sensors, cesium assets etc.)
 *  that the campus dashboard doesn't render — those return null and
 *  get filtered. */
function mapKind(value: ActivityEntityType): ChangeKind | null {
  switch (value) {
    case "NEWS_POST":
      return "news";
    case "EVENT_POST":
      return "event";
    case "CLUB":
      return "club";
    case "DINING_LOCATION":
      return "dining";
    case "BROADCAST":
      return "broadcast";
    case "PROJECT_MEMBER":
      return "member";
    case "PROJECT":
      return "campus";
    default:
      return null;
  }
}

function hrefFor(kind: ChangeKind, base: string): string {
  switch (kind) {
    case "news":
      return `${base}/news`;
    case "event":
      return `${base}/events`;
    case "club":
      return `${base}/clubs`;
    case "dining":
      return `${base}/dining`;
    case "campus":
      return `${base}/identity`;
    case "broadcast":
      return `${base}/reach`;
    case "member":
      return `${base}/members`;
    case "subscribers":
      return `${base}/reach`;
  }
}

function humanAction(action: ActivityActionType): string {
  switch (action) {
    case "CREATED":
      return "Created";
    case "UPDATED":
      return "Updated";
    case "DELETED":
      return "Deleted";
    case "RENAMED":
      return "Renamed";
    case "PUBLISHED":
      return "Published";
    case "ARCHIVED":
      return "Archived";
    case "ADDED":
      return "Added";
    case "REMOVED":
      return "Removed";
    case "SYNCED":
      return "Synced";
  }
}

function humanEntity(value: ActivityEntityType): string {
  switch (value) {
    case "NEWS_POST":
      return "news post";
    case "EVENT_POST":
      return "event";
    case "CLUB":
      return "club";
    case "DINING_LOCATION":
      return "dining venue";
    case "BROADCAST":
      return "broadcast";
    case "PROJECT_MEMBER":
      return "member access";
    case "PROJECT":
      return "campus settings";
    default:
      return "item";
  }
}
