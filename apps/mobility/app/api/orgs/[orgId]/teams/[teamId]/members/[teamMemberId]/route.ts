/**
 * DELETE /api/orgs/[orgId]/teams/[teamId]/members/[teamMemberId]
 *   Remove a user from a team. 404 when the row doesn't belong to
 *   the given team+org (defence-in-depth against id-guessing).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgAccess } from "@/lib/authz";

type Params = Promise<{
  orgId: string;
  teamId: string;
  teamMemberId: string;
}>;

export async function DELETE(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { orgId, teamId, teamMemberId } = await params;
  const denied = await requireOrgAccess(orgId, "manage");
  if (denied) return denied;

  const row = await prisma.teamMember.findFirst({
    where: {
      id: teamMemberId,
      teamId,
      team: { organizationId: orgId },
    },
    select: { id: true },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.teamMember.delete({ where: { id: teamMemberId } });
  return NextResponse.json({ ok: true });
}
