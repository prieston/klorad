/**
 * GET /api/worlds/[worldId]/broadcasts
 *   Recent broadcast audit log (last 10). Reads from `MobilityWorldEvent`
 *   rows tagged `broadcast_sent` — the same rows the broadcast POST
 *   endpoint appends. Meta carries `{title, attempted, delivered, pruned}`.
 *
 * Requires `read` on the project — the audit log is operator-only.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/authz";

type Params = Promise<{ worldId: string }>;

export async function GET(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { worldId } = await params;
  const world = await prisma.mobilityWorld.findUnique({
    where: { id: worldId },
    select: { projectId: true },
  });
  if (!world) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = await requireProjectAccess(world.projectId, "read");
  if (denied) return denied;

  const rows = await prisma.mobilityWorldEvent.findMany({
    where: { worldId, kind: "broadcast_sent" },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, createdAt: true, meta: true },
  });

  return NextResponse.json({
    broadcasts: rows.map((r) => {
      const meta = (r.meta ?? {}) as {
        title?: string;
        attempted?: number;
        delivered?: number;
        pruned?: number;
        url?: string;
      };
      return {
        id: r.id,
        sentAt: r.createdAt.toISOString(),
        title: meta.title ?? null,
        attempted: meta.attempted ?? 0,
        delivered: meta.delivered ?? 0,
        pruned: meta.pruned ?? 0,
        url: meta.url ?? null,
      };
    }),
  });
}
