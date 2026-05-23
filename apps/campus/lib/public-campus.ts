import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

/** Tag used to invalidate every cached public-campus lookup on edits. */
export const CAMPUS_CACHE_TAG = "public-campus";

/**
 * Cached campus lookup for the public routes (home, map).
 *
 * Public pages would otherwise hit the database on every request —
 * fine for a quiet site, painful under traffic. We cache the lookup
 * for 60 seconds and invalidate it on every campus PATCH via
 * {@link CAMPUS_CACHE_TAG}, so owner edits appear quickly.
 *
 * The selection is a superset that satisfies both the home and the
 * map pages (and the home's `generateMetadata`) so they share one
 * cache entry per token.
 */
export const getPublicCampusByToken = unstable_cache(
  async (token: string) => {
    return prisma.project
      .findUnique({
        where: { id: token },
        select: {
          id: true,
          title: true,
          description: true,
          isPublished: true,
          thumbnail: true,
          sceneData: true,
        },
      })
      .catch(() => null);
  },
  ["public-campus-by-token"],
  { revalidate: 60, tags: [CAMPUS_CACHE_TAG] },
);
