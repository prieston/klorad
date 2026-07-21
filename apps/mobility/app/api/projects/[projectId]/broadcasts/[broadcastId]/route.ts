/**
 * DELETE /api/projects/[projectId]/broadcasts/[broadcastId]
 *   Remove a Broadcast row. Used by the Reach tab's per-row Delete
 *   action so operators can prune the visitor Notifications feed
 *   without touching the `MobilityAlert` audit log (alert rows keep
 *   their `closedAt` timestamp for history).
 *
 * Requires project `write` — same gate as create.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/authz";

type Params = Promise<{ projectId: string; broadcastId: string }>;

export async function DELETE(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { projectId, broadcastId } = await params;
  const denied = await requireProjectAccess(projectId, "write");
  if (denied) return denied;

  // Confirm the broadcast belongs to this project before deleting —
  // stops a stray id from a URL edit reaching another org's rows.
  const row = await prisma.broadcast.findFirst({
    where: { id: broadcastId, projectId },
    select: { id: true },
  });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.broadcast.delete({ where: { id: broadcastId } });
  return NextResponse.json({ ok: true });
}
