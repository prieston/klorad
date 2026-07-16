/**
 * GET /api/projects/[projectId]/devices
 * List devices for the project's operator console.
 * Optional query filters:
 *   ?status=needs-review|included|public
 *   ?subsystem=cctv|dms
 * Default: all rows the project has synced.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/authz";

type Params = Promise<{ projectId: string }>;

export async function GET(
  req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { projectId } = await params;
  const denied = await requireProjectAccess(projectId, "read");
  if (denied) return denied;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const subsystem = url.searchParams.get("subsystem");
  const where: {
    projectId: string;
    included?: boolean;
    isPublic?: boolean;
    needsReview?: boolean;
    subsystem?: string;
  } = { projectId };
  if (status === "included") where.included = true;
  else if (status === "public") where.isPublic = true;
  else if (status === "needs-review") where.needsReview = true;
  if (subsystem) where.subsystem = subsystem;

  const rows = await prisma.mobilityDevice.findMany({
    where,
    orderBy: { lastSeenAt: "desc" },
    // Demo mock alone syncs ~775 devices across 6 subsystems; a
    // 500-row cap silently dropped whichever subsystem was written
    // earliest (CCTV, DMS) since ordering is `lastSeenAt desc`.
    // A real production tenant with tens of thousands of devices
    // needs cursor pagination — tracked as follow-up. For now bump
    // the cap to 5000, which covers every demo scenario and any
    // reasonable single-corridor deployment.
    take: 5000,
    select: {
      id: true,
      externalDeviceId: true,
      subsystem: true,
      name: true,
      type: true,
      lat: true,
      lng: true,
      primaryRoad: true,
      crossRoad: true,
      direction: true,
      agency: true,
      payload: true,
      included: true,
      isPublic: true,
      customLabel: true,
      needsReview: true,
      sourceId: true,
      lastSeenAt: true,
    },
  });
  return NextResponse.json({ devices: rows });
}
