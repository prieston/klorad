/**
 * DELETE /api/worlds/[worldId]/principals/[principalId]
 *   Revoke an access grant. 404 when the row doesn't belong to the
 *   given world (defence-in-depth against id-guessing across worlds).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/authz";

type Params = Promise<{ worldId: string; principalId: string }>;

export async function DELETE(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { worldId, principalId } = await params;
  const world = await prisma.mobilityWorld.findUnique({
    where: { id: worldId },
    select: { projectId: true },
  });
  if (!world) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = await requireProjectAccess(world.projectId, "write");
  if (denied) return denied;

  const row = await prisma.mobilityWorldPrincipal.findFirst({
    where: { id: principalId, worldId },
    select: { id: true },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.mobilityWorldPrincipal.delete({ where: { id: principalId } });
  return NextResponse.json({ ok: true });
}
