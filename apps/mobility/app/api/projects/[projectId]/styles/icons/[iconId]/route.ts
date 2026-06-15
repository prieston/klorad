/**
 * `DELETE /api/projects/[projectId]/styles/icons/[iconId]`
 *
 * Drop a custom icon. Any subsystem styles that still reference it
 * via `custom:<id>` revert to the stock default — done by deleting
 * those rows here so the resolver re-picks the default lazily.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/authz";

type Params = Promise<{ projectId: string; iconId: string }>;

export async function DELETE(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { projectId, iconId } = await params;
  const denied = await requireProjectAccess(projectId, "write");
  if (denied) return denied;

  const ref = `custom:${iconId}`;
  await prisma.$transaction([
    prisma.mobilityDeviceStyle.deleteMany({
      where: { projectId, iconKey: ref },
    }),
    prisma.mobilityCustomIcon.deleteMany({
      where: { id: iconId, projectId },
    }),
  ]);
  return NextResponse.json({ ok: true });
}
