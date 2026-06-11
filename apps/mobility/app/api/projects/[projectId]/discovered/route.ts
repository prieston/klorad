/**
 * GET /api/projects/[projectId]/discovered
 * Triage queue: every device currently flagged `needsReview`,
 * grouped by source so the operator can act on whole sync batches.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/authz";

type Params = Promise<{ projectId: string }>;

export async function GET(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { projectId } = await params;
  const denied = await requireProjectAccess(projectId, "read");
  if (denied) return denied;

  const devices = await prisma.mobilityDevice.findMany({
    where: { projectId, needsReview: true },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      externalDeviceId: true,
      subsystem: true,
      name: true,
      type: true,
      primaryRoad: true,
      crossRoad: true,
      direction: true,
      agency: true,
      lat: true,
      lng: true,
      sourceId: true,
      createdAt: true,
      lastSeenAt: true,
    },
  });

  if (devices.length === 0) {
    return NextResponse.json({ groups: [], total: 0 });
  }

  const sources = await prisma.mobilityDataSource.findMany({
    where: { id: { in: Array.from(new Set(devices.map((d) => d.sourceId))) } },
    select: {
      id: true,
      label: true,
      connectorId: true,
      lastSyncedAt: true,
    },
  });
  const sourceMap = new Map(sources.map((s) => [s.id, s]));

  // Group by sourceId, preserve catalogue order within each group.
  const grouped = new Map<
    string,
    {
      sourceId: string;
      label: string;
      connectorId: string;
      lastSyncedAt: string | null;
      devices: typeof devices;
    }
  >();
  for (const d of devices) {
    const s = sourceMap.get(d.sourceId);
    if (!s) continue;
    const existing = grouped.get(d.sourceId);
    if (existing) {
      existing.devices.push(d);
    } else {
      grouped.set(d.sourceId, {
        sourceId: s.id,
        label: s.label,
        connectorId: s.connectorId,
        lastSyncedAt: s.lastSyncedAt?.toISOString() ?? null,
        devices: [d],
      });
    }
  }

  return NextResponse.json({
    groups: Array.from(grouped.values()).map((g) => ({
      sourceId: g.sourceId,
      label: g.label,
      connectorId: g.connectorId,
      lastSyncedAt: g.lastSyncedAt,
      devices: g.devices.map((d) => ({
        ...d,
        createdAt: d.createdAt.toISOString(),
        lastSeenAt: d.lastSeenAt.toISOString(),
      })),
    })),
    total: devices.length,
  });
}
