/**
 * Student clubs — DB-backed (Arc 4 of [[campus-consumer-pivot]]).
 *
 * Per-Project club rows authored in the dashboard. Renders on the
 * consumer home's "Most active clubs this week" rail (sorted by
 * `popularityScore` desc, then `memberCount`). No tracking, no
 * accounts — the View button opens an external link.
 */
import { prisma } from "@/lib/prisma";
import type { Club as PrismaClub, ClubColor } from "@prisma/client";

export type { ClubColor } from "@prisma/client";

export interface ClubAnchor {
  kind: "building" | "room";
  refId: string;
  refName: string;
}

export interface Club {
  id: string;
  projectId: string;
  name: string;
  description: string;
  initials: string;
  avatarColor: ClubColor;
  memberCount: number;
  meetsCadence: string | null;
  externalLink: string | null;
  imageUrl: string | null;
  popularityScore: number;
  anchors: ClubAnchor[];
}

function parseAnchors(raw: unknown): ClubAnchor[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (a): a is ClubAnchor =>
      !!a &&
      typeof a === "object" &&
      "refName" in a &&
      typeof (a as { refName?: unknown }).refName === "string",
  );
}

function fromPrisma(row: PrismaClub): Club {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    description: row.description,
    initials: row.initials,
    avatarColor: row.avatarColor,
    memberCount: row.memberCount,
    meetsCadence: row.meetsCadence,
    externalLink: row.externalLink,
    imageUrl: row.imageUrl,
    popularityScore: row.popularityScore,
    anchors: parseAnchors(row.anchors),
  };
}

/** Top N clubs for the consumer rail — popularityScore desc, then size. */
export async function listTopClubsForProject(
  projectId: string,
  limit = 6,
): Promise<Club[]> {
  const rows = await prisma.club.findMany({
    where: { projectId },
    orderBy: [
      { popularityScore: "desc" },
      { memberCount: "desc" },
      { name: "asc" },
    ],
    take: limit,
  });
  return rows.map(fromPrisma);
}

/** Admin view — everything by name asc. */
export async function listClubsForAdmin(
  projectId: string,
): Promise<Club[]> {
  const rows = await prisma.club.findMany({
    where: { projectId },
    orderBy: { name: "asc" },
  });
  return rows.map(fromPrisma);
}

/**
 * Single club by id. Returns `null` both for "doesn't exist" and for
 * "the runtime can't query yet" (pending migration / unregenerated
 * client), so the detail page renders 404 instead of crashing. The
 * error is logged so the deploy-time fix is still visible.
 */
export async function getClub(id: string): Promise<Club | null> {
  try {
    const row = await prisma.club.findUnique({ where: { id } });
    return row ? fromPrisma(row) : null;
  } catch (err) {
    console.error("[clubs-db] getClub failed", err);
    return null;
  }
}

/** "DS" from "Data Science Society". Two letters, uppercase. */
export function deriveInitials(name: string): string {
  const words = name
    .replace(/[^\p{L}\s]/gu, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "??";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
