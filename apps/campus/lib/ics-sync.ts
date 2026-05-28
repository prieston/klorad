/**
 * ICS → `EventPost` sync.
 *
 * Fetches every feed URL in `sceneData.eventFeeds`, parses occurrences
 * via the existing `fetchCampusEvents` pipeline, and **upserts** each
 * into the `EventPost` table keyed on the unique `(projectId,
 * externalId)` pair. Re-syncing the same feed is idempotent — same
 * id → update; new id → insert.
 *
 * Imported rows carry `source = "ics"` so the admin UI can flag them
 * as read-only, and so a future cleanup pass could prune events that
 * fell off the feed if the operator wants that. For Arc 8 we don't
 * prune — past events naturally exit the consumer rail via the
 * `endsAt >= now()` filter.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchCampusEvents } from "@/lib/events-server";
import type { CampusEvent } from "@/lib/events";

export interface IcsSyncResult {
  fetched: number;
  inserted: number;
  updated: number;
  feeds: number;
}

interface ProjectRef {
  projectId: string;
  organizationId: string;
}

/** One CampusEvent → the upsert-shaped Prisma data. */
function eventToData(
  event: CampusEvent,
  { projectId, organizationId }: ProjectRef,
) {
  const refName = event.location?.trim();
  return {
    organizationId,
    projectId,
    title: event.title,
    // ICS doesn't carry a description — use the location as a fallback
    // so the consumer card has something to render. Admins can edit
    // the row's description and it'll get overwritten on next sync
    // (the trade-off documented at the top of this file).
    description: refName ?? "",
    startsAt: new Date(event.start),
    endsAt: new Date(event.end),
    bannerColor: "teal" as const,
    bannerIcon: "calendar" as const,
    expectedAttendance: null,
    organizer: null,
    registrationUrl: null,
    imageUrl: null,
    anchors: (refName
      ? [{ kind: "building", refId: "", refName }]
      : []) as unknown as Prisma.InputJsonValue,
    externalId: event.id,
    source: "ics",
  };
}

/**
 * Pull every feed for `projectId` and upsert each occurrence.
 *
 * Returns counts you can show in the admin toast / log:
 *   - `fetched`: total occurrences across all feeds (post-expansion)
 *   - `inserted`: new rows created
 *   - `updated`: existing rows refreshed
 */
export async function syncIcsForProject(
  projectId: string,
  feedUrls: string[],
): Promise<IcsSyncResult> {
  if (feedUrls.length === 0) {
    return { fetched: 0, inserted: 0, updated: 0, feeds: 0 };
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { organizationId: true },
  });
  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  const events = await fetchCampusEvents(feedUrls);
  const ref: ProjectRef = {
    projectId,
    organizationId: project.organizationId,
  };

  let inserted = 0;
  let updated = 0;

  // Sequential upserts — the volume is bounded (events-server caps at
  // `MAX_EVENTS = 12`), so transaction batching wouldn't pay off. If
  // the cap is lifted later, a `prisma.$transaction([…])` collected
  // upsert is the obvious next step.
  for (const event of events) {
    const data = eventToData(event, ref);
    const existing = await prisma.eventPost.findUnique({
      where: {
        projectId_externalId: {
          projectId,
          externalId: event.id,
        },
      },
      select: { id: true },
    });
    if (existing) {
      await prisma.eventPost.update({
        where: { id: existing.id },
        data,
      });
      updated += 1;
    } else {
      await prisma.eventPost.create({ data });
      inserted += 1;
    }
  }

  return {
    fetched: events.length,
    inserted,
    updated,
    feeds: feedUrls.length,
  };
}
