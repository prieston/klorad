/**
 * GET /api/public/projects/[projectId]/devices
 * Anonymous, read-only. Returns only devices flagged `isPublic`
 * on a project that is itself published + public. Never returns
 * encrypted credentials or the connector's raw payload.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  loadPublicProject,
  projectIsPubliclyVisible,
} from "@/lib/mobility/publish-gate";

type Params = Promise<{ projectId: string }>;

export async function GET(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { projectId } = await params;
  const project = await loadPublicProject(projectId);
  if (!project || !projectIsPubliclyVisible(project)) {
    return NextResponse.json({ error: "Not published" }, { status: 404 });
  }
  const rows = await prisma.mobilityDevice.findMany({
    where: { projectId, isPublic: true },
    orderBy: { lastSeenAt: "desc" },
    take: 500,
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
      customLabel: true,
    },
  });
  return NextResponse.json({ devices: rows });
}
