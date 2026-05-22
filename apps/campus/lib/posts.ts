/**
 * Campus news posts.
 *
 * Posts live in the campus `sceneData` JSON (`sceneData.posts`) — the
 * same store branding and the indoor map id use — so adding news
 * needs no schema migration. If news grows (pagination, scheduling,
 * per-post media) this graduates to its own Prisma model.
 */
export interface CampusPost {
  id: string;
  title: string;
  body: string;
  /** ISO timestamp. */
  publishedAt: string;
}

/** Read a campus's news posts from its `sceneData`, newest first. */
export function readPosts(sceneData: unknown): CampusPost[] {
  const raw = (sceneData as { posts?: unknown } | null | undefined)?.posts;
  if (!Array.isArray(raw)) return [];
  return (raw as CampusPost[])
    .filter((p): p is CampusPost => Boolean(p) && typeof p.title === "string")
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
