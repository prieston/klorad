/**
 * Campus news posts.
 *
 * Posts live in the campus `sceneData` JSON (`sceneData.posts`) — the
 * same store branding and the indoor map id use — so adding news
 * needs no schema migration. If news grows (pagination, scheduling,
 * per-post media) this graduates to its own Prisma model.
 */
import type { Localizable } from "@/app/lib/i18n-core";

export type PlaceKind = "building" | "floor" | "room";

/**
 * A campus place a post is connected to. The `name` is denormalised
 * so the public page can show it without resolving the scene graph.
 */
export interface PostPlace {
  id: string;
  kind: PlaceKind;
  name: string;
}

export interface CampusPost {
  id: string;
  /** Title — bilingual; legacy posts may carry a plain string. */
  title: Localizable;
  /** Body — bilingual; legacy posts may carry a plain string. */
  body: Localizable;
  /** ISO timestamp. */
  publishedAt: string;
  /** Optional building / floor / room this post is about. */
  place?: PostPlace;
}

/** Read a campus's news posts from its `sceneData`, newest first. */
export function readPosts(sceneData: unknown): CampusPost[] {
  const raw = (sceneData as { posts?: unknown } | null | undefined)?.posts;
  if (!Array.isArray(raw)) return [];
  return (raw as CampusPost[])
    .filter((p): p is CampusPost => Boolean(p) && p.title != null)
    .slice()
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

/** Format a post's ISO date for display. */
export function formatPostDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
