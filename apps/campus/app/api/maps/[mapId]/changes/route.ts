import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCampusAccess } from "@/lib/authz";
import { readCampusChanges } from "@/lib/changes";

type Params = Promise<{ mapId: string }>;

/**
 * `GET /api/maps/[mapId]/changes` — recent activity feed for the
 * campus dashboard's "What Changed" card.
 *
 * Built from satellite-model `updatedAt` columns rather than a
 * dedicated audit log — see `lib/changes.ts` for the rationale.
 * Read-gated so only campus members see the feed; the data leaks
 * nothing the dashboard itself doesn't already show, but the URL
 * shouldn't be a probe vector for external scanners.
 */
export async function GET(_req: Request, { params }: { params: Params }) {
  const { mapId } = await params;
  const denied = await requireCampusAccess(mapId, "read");
  if (denied) return denied;

  // The dashboard scopes itself by org id (used for the hrefs); we
  // resolve it from the project rather than asking the client to
  // pass it on a URL it could spoof.
  const project = await prisma.project.findUnique({
    where: { id: mapId },
    select: { organizationId: true },
  });
  if (!project) {
    return NextResponse.json({ items: [] }, { status: 404 });
  }

  try {
    const items = await readCampusChanges({
      mapId,
      orgId: project.organizationId,
      limit: 8,
    });
    return NextResponse.json({ items });
  } catch (err) {
    console.error("[changes]", err);
    // Empty-state degradation — the card stays mounted with its
    // "No activity yet" message instead of the whole dashboard
    // rendering an error.
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}
