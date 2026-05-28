/**
 * Dining locations — DB-backed (Arc 5 of [[campus-consumer-pivot]]).
 *
 * The smallest of the four content arcs because dining is mostly
 * static: cafeterias, cafes, and food courts with hours + an
 * optional menu link. No detail page — the public list view holds
 * everything because each row is small.
 */
import { prisma } from "@/lib/prisma";
import type { DiningLocation as PrismaDining } from "@prisma/client";

export interface DiningAnchor {
  kind: "building" | "room";
  refId: string;
  refName: string;
}

export interface DiningLocation {
  id: string;
  projectId: string;
  name: string;
  /** Greek translation, optional. */
  nameEl: string | null;
  description: string;
  /** Greek translation, optional. */
  descriptionEl: string | null;
  hoursText: string | null;
  cuisine: string | null;
  menuUrl: string | null;
  imageUrl: string | null;
  anchors: DiningAnchor[];
}

function parseAnchors(raw: unknown): DiningAnchor[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (a): a is DiningAnchor =>
      !!a &&
      typeof a === "object" &&
      "refName" in a &&
      typeof (a as { refName?: unknown }).refName === "string",
  );
}

function fromPrisma(row: PrismaDining): DiningLocation {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    nameEl: row.nameEl,
    description: row.description,
    descriptionEl: row.descriptionEl,
    hoursText: row.hoursText,
    cuisine: row.cuisine,
    menuUrl: row.menuUrl,
    imageUrl: row.imageUrl,
    anchors: parseAnchors(row.anchors),
  };
}

/**
 * Public + admin view — alphabetical by name. Dining is rarely
 * large enough to need pagination; if a campus hits that, sort
 * by anchor / nearest is the right next move, not infinite lists.
 *
 * Wrapped in `try/catch` so a pending migration / unregenerated
 * Prisma client returns `[]` instead of crashing the page — same
 * pattern as the other Arc 2-4 reads.
 */
export async function listDiningForProject(
  projectId: string,
): Promise<DiningLocation[]> {
  try {
    const rows = await prisma.diningLocation.findMany({
      where: { projectId },
      orderBy: { name: "asc" },
    });
    return rows.map(fromPrisma);
  } catch (err) {
    console.error("[dining-db] listDiningForProject failed", err);
    return [];
  }
}
