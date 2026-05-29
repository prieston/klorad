import { NextResponse } from "next/server";
import { getPublicCampusByToken } from "@/lib/public-campus";
import { listUpcomingEventsForProject } from "@/lib/events-db";

type Params = Promise<{ token: string }>;

/**
 * `GET /api/campus/[token]/events`
 *
 * Public DB event feed. ICS-sourced events are NOT included here —
 * they're fetched server-side in the page render once per request
 * and merged into the initial list, but the SWR background
 * refetch only revalidates the database side (the cheap, cacheable
 * one). Same pattern as news / legacy `sceneData.posts`.
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
  const events = await listUpcomingEventsForProject(map.id, 100).catch(
    () => [],
  );
  return NextResponse.json({ events });
}
