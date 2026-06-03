import { NextResponse } from "next/server";
import { requireCampusAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ mapId: string }>;

/**
 * `GET /api/maps/[mapId]/broadcasts` — the Reach screen's history
 * list. Most-recent first, capped at 25 so we don't ship the full
 * archive on every poll. Read-gated.
 */
export async function GET(_req: Request, { params }: { params: Params }) {
  const { mapId } = await params;
  const denied = await requireCampusAccess(mapId, "read");
  if (denied) return denied;

  try {
    const rows = await prisma.broadcast.findMany({
      where: { projectId: mapId },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: {
        id: true,
        title: true,
        body: true,
        targetPath: true,
        attempted: true,
        delivered: true,
        pruned: true,
        opened: true,
        createdAt: true,
        sender: { select: { name: true, email: true } },
      },
    });
    return NextResponse.json({
      items: rows.map((b) => ({
        id: b.id,
        title: b.title,
        body: b.body,
        targetPath: b.targetPath,
        attempted: b.attempted,
        delivered: b.delivered,
        pruned: b.pruned,
        opened: b.opened,
        sentAt: b.createdAt.toISOString(),
        senderName:
          b.sender?.name ?? b.sender?.email?.split("@")[0] ?? null,
      })),
    });
  } catch (err) {
    console.error("[broadcasts]", err);
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}
