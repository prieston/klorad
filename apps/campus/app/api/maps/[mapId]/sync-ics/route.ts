import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { requireCampusAccess } from "@/lib/authz";
import { publicCampusTag } from "@/lib/public-campus";
import { readEventFeeds } from "@/lib/events";
import { syncIcsForProject } from "@/lib/ics-sync";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ mapId: string }>;

/**
 * POST /api/maps/[mapId]/sync-ics
 *
 * Pulls every URL in `sceneData.eventFeeds` and upserts each
 * occurrence into `EventPost` so the chat tools + consumer rail see
 * them alongside manual events. Same `(projectId, externalId)`
 * uniqueness means re-running is idempotent.
 *
 * Auth: campus write access. Returns the counts the admin UI shows
 * in a toast.
 */
export async function POST(_req: Request, { params }: { params: Params }) {
  const { mapId } = await params;
  const denied = await requireCampusAccess(mapId, "write");
  if (denied) return denied;

  // Pull the project's sceneData directly — `getPublicCampusByToken`
  // is per-token, not per-id, so use a direct read here.
  const project = await prisma.project.findUnique({
    where: { id: mapId },
    select: { sceneData: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Campus not found" }, { status: 404 });
  }

  const feedUrls = readEventFeeds(project.sceneData);
  if (feedUrls.length === 0) {
    return NextResponse.json({
      ok: true,
      result: { fetched: 0, inserted: 0, updated: 0, feeds: 0 },
      note: "No ICS feeds configured.",
    });
  }

  try {
    const result = await syncIcsForProject(mapId, feedUrls);
    revalidateTag(publicCampusTag(mapId));
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error("[sync-ics]", err);
    return NextResponse.json(
      { error: "ICS sync failed" },
      { status: 500 },
    );
  }
}

