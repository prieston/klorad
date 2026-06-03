import "server-only";
import { prisma } from "@/lib/prisma";

export type ChangeKind =
  | "news"
  | "event"
  | "club"
  | "dining"
  | "campus"
  | "subscribers";

export interface CampusChange {
  /** Stable identifier — composed `<kind>:<rowId>` so React keys never clash. */
  id: string;
  kind: ChangeKind;
  /** Human-readable label, e.g. `"Exam schedule"` or `"Branding updated"`. */
  title: string;
  /** Optional deep-link into the dashboard. */
  href?: string;
  /** Optional one-line context, e.g. `"3 new"` or `"posted by Maria"`. */
  detail?: string;
  /** True for creations (createdAt ≈ updatedAt), false for updates. */
  isNew: boolean;
  /** ISO timestamp — the change's `updatedAt`. */
  at: string;
}

/** How many rows to read per satellite model before merging. The merged
 *  list is capped at `limit`; over-reading per model keeps the merge
 *  fair when one model has a sustained edit burst. */
const PER_MODEL_LIMIT = 10;
/** "Created" vs "updated" — Prisma stamps `createdAt` and `updatedAt`
 *  in the same write, but they can drift by a few ms. Treat the gap
 *  as a creation. */
const CREATION_GAP_MS = 5_000;
/** Activity window — anything older than this drops out of the feed
 *  even if there's slack in the per-model cap. */
const WINDOW_DAYS = 30;

interface BuildOpts {
  /** Project / campus id. */
  mapId: string;
  /** Org id — used to scope the org-tier hrefs. */
  orgId: string;
  /** How many changes to return after merging. */
  limit?: number;
}

/**
 * "What changed" feed for a campus dashboard.
 *
 * We don't have a dedicated audit-log model — every write would need
 * to be re-routed through one — so this builds the feed from the
 * `updatedAt` columns we already maintain on news / events / clubs /
 * dining + the project itself. Good enough to answer "what did the
 * team do this week?" without a schema change; we can swap in a real
 * `Activity` reader later without touching the UI (just this file).
 *
 * Subscriber growth is rolled up into a single entry so a one-tab
 * burst of installs doesn't drown the rest of the feed.
 */
export async function readCampusChanges({
  mapId,
  orgId,
  limit = 8,
}: BuildOpts): Promise<CampusChange[]> {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const dashBase = `/org/${orgId}/maps/${mapId}`;

  const [project, news, events, clubs, dining, recentSubs] =
    await Promise.all([
      prisma.project.findUnique({
        where: { id: mapId },
        select: {
          id: true,
          title: true,
          updatedAt: true,
          createdAt: true,
          isPublished: true,
        },
      }),
      prisma.newsPost
        .findMany({
          where: { projectId: mapId, updatedAt: { gte: since } },
          orderBy: { updatedAt: "desc" },
          take: PER_MODEL_LIMIT,
          select: {
            id: true,
            title: true,
            updatedAt: true,
            createdAt: true,
          },
        })
        .catch(() => []),
      prisma.eventPost
        .findMany({
          where: { projectId: mapId, updatedAt: { gte: since } },
          orderBy: { updatedAt: "desc" },
          take: PER_MODEL_LIMIT,
          select: {
            id: true,
            title: true,
            updatedAt: true,
            createdAt: true,
          },
        })
        .catch(() => []),
      prisma.club
        .findMany({
          where: { projectId: mapId, updatedAt: { gte: since } },
          orderBy: { updatedAt: "desc" },
          take: PER_MODEL_LIMIT,
          select: {
            id: true,
            name: true,
            updatedAt: true,
            createdAt: true,
          },
        })
        .catch(() => []),
      prisma.diningLocation
        .findMany({
          where: { projectId: mapId, updatedAt: { gte: since } },
          orderBy: { updatedAt: "desc" },
          take: PER_MODEL_LIMIT,
          select: {
            id: true,
            name: true,
            updatedAt: true,
            createdAt: true,
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

  for (const row of news) {
    items.push(makeRow("news", row.id, row.title, row.createdAt, row.updatedAt, `${dashBase}/news`));
  }
  for (const row of events) {
    items.push(makeRow("event", row.id, row.title, row.createdAt, row.updatedAt, `${dashBase}/events`));
  }
  for (const row of clubs) {
    items.push(makeRow("club", row.id, row.name, row.createdAt, row.updatedAt, `${dashBase}/clubs`));
  }
  for (const row of dining) {
    items.push(makeRow("dining", row.id, row.name, row.createdAt, row.updatedAt, `${dashBase}/dining`));
  }

  // Project-level change: branding / publish state / scene edits.
  // We can't tell what specifically moved without an audit log, so
  // we label it as either "Branding & settings updated" or "Campus
  // published" — the latter only if isPublished is true and updatedAt
  // is fresh.
  if (project && project.updatedAt >= since) {
    const projectIsNew =
      project.updatedAt.getTime() - project.createdAt.getTime() <
      CREATION_GAP_MS;
    items.push({
      id: `campus:${project.id}:${project.updatedAt.getTime()}`,
      kind: "campus",
      title: projectIsNew
        ? "Campus created"
        : project.isPublished
          ? "Campus settings updated"
          : "Draft settings updated",
      href: `${dashBase}/identity`,
      isNew: projectIsNew,
      at: project.updatedAt.toISOString(),
    });
  }

  // Push subscribers rolled up into one entry. The endpoint is the
  // dashboard's Reach screen — clicking through gives the live total
  // and the broadcast composer in one place.
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
      // Timestamp at "now" so this floats to the top when activity is
      // otherwise thin — feels right because the count IS current,
      // not a single past event.
      at: new Date().toISOString(),
    });
  }

  // Newest first, capped.
  items.sort((a, b) => b.at.localeCompare(a.at));
  return items.slice(0, limit);
}

function makeRow(
  kind: ChangeKind,
  id: string,
  title: string,
  createdAt: Date,
  updatedAt: Date,
  href: string,
): CampusChange {
  const isNew =
    updatedAt.getTime() - createdAt.getTime() < CREATION_GAP_MS;
  return {
    id: `${kind}:${id}`,
    kind,
    title,
    href,
    isNew,
    at: updatedAt.toISOString(),
  };
}
