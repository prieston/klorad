import { NextResponse } from "next/server";
import { getPublicCampusByToken } from "@/lib/public-campus";
import { listNewsForProject } from "@/lib/news";

type Params = Promise<{ token: string }>;

/**
 * `GET /api/campus/[token]/news`
 *
 * Public news feed for the campus. Mirrors the data the server
 * page (`news/page.tsx`) renders SSR; client components powered by
 * SWR (`useCampusNews`) call this for background revalidation and
 * for in-session navigation cache hits.
 *
 * - Resolves the token through the same cached `Project` lookup
 *   the public pages use (per-token cache; no DB hit on consecutive
 *   reads within the cache TTL).
 * - 404s when the campus is unknown or unpublished.
 * - Defensive: if the underlying `listNewsForProject` throws (e.g.,
 *   migrations pending), returns an empty list rather than 500.
 */
export async function GET(
  _req: Request,
  { params }: { params: Params },
) {
  const { token } = await params;
  const map = await getPublicCampusByToken(token);
  if (!map || !map.isPublished) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const news = await listNewsForProject(map.id).catch(() => []);
  return NextResponse.json({ news });
}
