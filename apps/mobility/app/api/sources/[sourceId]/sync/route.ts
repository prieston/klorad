/**
 * POST /api/sources/[sourceId]/sync — trigger a sync run inline.
 *
 * Synchronous Vercel-function execution in v1. PR 13 of the arc
 * moves to Inngest so long catalogs survive deploys; the request
 * shape is forward-compatible (caller still gets the SyncResult,
 * Inngest just runs it in the background).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/authz";
import { runSync } from "@/lib/mobility/sync";

type Params = Promise<{ sourceId: string }>;

/** ATMS catalogs of a few hundred devices fit comfortably in three
 *  minutes; the cap is the safety net, not the design budget. Larger
 *  fleets graduate to background Inngest jobs in a follow-up arc. */
export const maxDuration = 180;

export async function POST(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { sourceId } = await params;
  const row = await prisma.mobilityDataSource.findUnique({
    where: { id: sourceId },
    select: { projectId: true, enabled: true },
  });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!row.enabled) {
    return NextResponse.json(
      { error: "Source is disabled" },
      { status: 409 },
    );
  }
  const denied = await requireProjectAccess(row.projectId, "write");
  if (denied) return denied;

  const result = await runSync(sourceId);
  return NextResponse.json(result);
}
