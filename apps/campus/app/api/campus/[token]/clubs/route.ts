import { NextResponse } from "next/server";
import { getPublicCampusByToken } from "@/lib/public-campus";
import { listTopClubsForProject } from "@/lib/clubs-db";

type Params = Promise<{ token: string }>;

/**
 * `GET /api/campus/[token]/clubs`
 *
 * Public clubs feed — top clubs by activity, capped at 50 to match
 * the SSR page. Same pattern as news + events: SSR seeds, SWR
 * revalidates.
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
  const clubs = await listTopClubsForProject(map.id, 50).catch(() => []);
  return NextResponse.json({ clubs });
}
