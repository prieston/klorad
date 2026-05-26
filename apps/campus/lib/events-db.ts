/**
 * Campus events — DB-backed (Arc 3 of [[campus-consumer-pivot]]).
 *
 * Per-Project event rows authored in the dashboard. ICS-sourced
 * recurring events still flow through `events-server.ts` and the
 * consumer surface merges both lists.
 */
import { prisma } from "@/lib/prisma";
import type {
  EventPost as PrismaEventPost,
  EventBanner,
  EventIcon,
} from "@prisma/client";

export type { EventBanner, EventIcon } from "@prisma/client";

export interface EventAnchor {
  kind: "building" | "room";
  refId: string;
  refName: string;
}

export interface EventPost {
  id: string;
  projectId: string;
  title: string;
  description: string;
  imageUrl: string | null;
  startsAt: string;
  endsAt: string;
  registrationUrl: string | null;
  organizer: string | null;
  bannerColor: EventBanner;
  bannerIcon: EventIcon;
  expectedAttendance: number | null;
  anchors: EventAnchor[];
}

function parseAnchors(raw: unknown): EventAnchor[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (a): a is EventAnchor =>
      !!a &&
      typeof a === "object" &&
      "refName" in a &&
      typeof (a as { refName?: unknown }).refName === "string",
  );
}

function fromPrisma(row: PrismaEventPost): EventPost {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    description: row.description,
    imageUrl: row.imageUrl,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    registrationUrl: row.registrationUrl,
    organizer: row.organizer,
    bannerColor: row.bannerColor,
    bannerIcon: row.bannerIcon,
    expectedAttendance: row.expectedAttendance,
    anchors: parseAnchors(row.anchors),
  };
}

/** Upcoming + ongoing events — what the consumer rail wants. */
export async function listUpcomingEventsForProject(
  projectId: string,
  limit = 12,
): Promise<EventPost[]> {
  const now = new Date();
  const rows = await prisma.eventPost.findMany({
    where: { projectId, endsAt: { gte: now } },
    orderBy: { startsAt: "asc" },
    take: limit,
  });
  return rows.map(fromPrisma);
}

/** Admin view — every event including ones that already finished. */
export async function listEventsForAdmin(
  projectId: string,
): Promise<EventPost[]> {
  const rows = await prisma.eventPost.findMany({
    where: { projectId },
    orderBy: { startsAt: "desc" },
  });
  return rows.map(fromPrisma);
}

export async function getEventPost(id: string): Promise<EventPost | null> {
  const row = await prisma.eventPost.findUnique({ where: { id } });
  return row ? fromPrisma(row) : null;
}

/** "Tue 6:00 pm" — same compact format as the consumer rail. */
export function formatEventWhen(startIso: string): string {
  const d = new Date(startIso);
  if (Number.isNaN(d.getTime())) return "";
  const day = d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const time = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: d.getMinutes() === 0 ? undefined : "2-digit",
  });
  return `${day} · ${time.toLowerCase()}`;
}
