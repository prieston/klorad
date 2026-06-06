/**
 * GET /api/maps/[mapId]/crawler/discovered — list pending discovered
 * items for the rector's inbox. Filter by `?type=news|event` so the
 * news + events admin pages can each pull only their slice.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCampusAccess } from "@/lib/authz";

type Params = Promise<{ mapId: string }>;

const VALID_TYPES = new Set(["news", "event"]);

export async function GET(req: Request, { params }: { params: Params }) {
  const { mapId } = await params;
  const denied = await requireCampusAccess(mapId, "read");
  if (denied) return denied;

  const url = new URL(req.url);
  const type = url.searchParams.get("type");

  const where: { projectId: string; status: "pending"; contentType?: string } = {
    projectId: mapId,
    status: "pending",
  };
  if (type && VALID_TYPES.has(type)) {
    where.contentType = type;
  }

  const items = await prisma.discoveredItem.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      sourceUrl: true,
      contentType: true,
      extracted: true,
      createdAt: true,
      job: {
        select: { startedAt: true, instructions: true },
      },
    },
  });

  // Counts per type so the UI tab labels can stay accurate without
  // a second roundtrip.
  const counts = await prisma.discoveredItem.groupBy({
    by: ["contentType"],
    where: { projectId: mapId, status: "pending" },
    _count: { _all: true },
  });
  const countsByType: Record<string, number> = {};
  for (const c of counts) {
    countsByType[c.contentType] = c._count._all;
  }

  return NextResponse.json({ items, countsByType });
}
