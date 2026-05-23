import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

/** Tag for a single campus's cached public lookup. */
export const publicCampusTag = (token: string) => `public-campus:${token}`;

/**
 * Cached campus lookup for the public routes (home, map).
 *
 * Public pages would otherwise hit the database on every request —
 * fine for a quiet site, painful under traffic. We cache per token
 * for 60s and invalidate just that token on its PATCH / DELETE via
 * {@link publicCampusTag} — one tenant's edits don't thrash every
 * other campus's cache entry.
 *
 * The `.catch(() => null)` sits *outside* the cached function so a
 * transient Prisma failure doesn't get cached as a permanent 404
 * for 60s — only real, settled results are cached.
 *
 * The selection is a superset that satisfies both the home and the
 * map pages (and the home's `generateMetadata`).
 */
export async function getPublicCampusByToken(token: string) {
  const cached = unstable_cache(
    async (t: string) => {
      return prisma.project.findUnique({
        where: { id: t },
        select: {
          id: true,
          title: true,
          description: true,
          isPublished: true,
          thumbnail: true,
          sceneData: true,
        },
      });
    },
    ["public-campus-by-token", token],
    { revalidate: 60, tags: [publicCampusTag(token)] },
  );
  try {
    return await cached(token);
  } catch {
    return null;
  }
}
