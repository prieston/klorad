/**
 * Campus news posts — server side.
 *
 * Arc 2 of [[campus-consumer-pivot]]. Promotes news from the
 * legacy `sceneData.posts` JSON ([[lib/posts.ts]]) to a dedicated
 * `NewsPost` Prisma model. The model is per-`Project` (a campus
 * map) and carries multi-anchor metadata as a JSON column — see
 * the `Anchor` shape below.
 *
 * Public reads land via `listNewsForProject` (sorted newest first,
 * expired entries dropped). Admin reads land via `listNewsForOrg`.
 */
import { prisma } from "@/lib/prisma";
import type { NewsPost as PrismaNewsPost, NewsCategory } from "@prisma/client";

export type { NewsCategory } from "@prisma/client";

/** Place a post is connected to — denormalised name + MappedIn id. */
export interface NewsAnchor {
  kind: "building" | "room";
  /** MappedIn space id; may be empty until the proper picker lands. */
  refId: string;
  refName: string;
}

/** The shape we surface to client + public — JSON columns parsed. */
export interface NewsPost {
  id: string;
  projectId: string;
  title: string;
  body: string;
  imageUrl: string | null;
  category: NewsCategory;
  publishedAt: string;
  expiresAt: string | null;
  anchors: NewsAnchor[];
  createdAt: string;
  updatedAt: string;
}

/** Type-narrowing for the JSON `anchors` column off the Prisma row. */
function parseAnchors(raw: unknown): NewsAnchor[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (a): a is NewsAnchor =>
      !!a &&
      typeof a === "object" &&
      "refName" in a &&
      typeof (a as { refName?: unknown }).refName === "string",
  );
}

function fromPrisma(row: PrismaNewsPost): NewsPost {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    body: row.body,
    imageUrl: row.imageUrl,
    category: row.category,
    publishedAt: row.publishedAt.toISOString(),
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    anchors: parseAnchors(row.anchors),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * News for a public campus surface — published + unexpired only,
 * newest first. Future arcs will add visibility flags; for now any
 * row in `NewsPost` is "published" the moment it's saved.
 */
export async function listNewsForProject(
  projectId: string,
  limit = 20,
): Promise<NewsPost[]> {
  const now = new Date();
  const rows = await prisma.newsPost.findMany({
    where: {
      projectId,
      publishedAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { publishedAt: "desc" },
    take: limit,
  });
  return rows.map(fromPrisma);
}

/** Admin view — everything for the project, including future-dated drafts. */
export async function listNewsForAdmin(
  projectId: string,
): Promise<NewsPost[]> {
  const rows = await prisma.newsPost.findMany({
    where: { projectId },
    orderBy: { publishedAt: "desc" },
  });
  return rows.map(fromPrisma);
}

/**
 * Single post by id — used by the public detail page. Returns
 * `null` both for "doesn't exist" and for a transient query failure
 * (pending migration etc.) so the detail page can 404 instead of
 * 500. The error is logged.
 */
export async function getNewsPost(id: string): Promise<NewsPost | null> {
  try {
    const row = await prisma.newsPost.findUnique({ where: { id } });
    return row ? fromPrisma(row) : null;
  } catch (err) {
    console.error("[news] getNewsPost failed", err);
    return null;
  }
}

/** Format a post's date for display. */
export function formatNewsDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Relative time ("2 days ago") — for the consumer rail. */
export function relativeNewsTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const day = 1000 * 60 * 60 * 24;
  const days = Math.floor(diffMs / day);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "a week ago";
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return formatNewsDate(iso);
}
