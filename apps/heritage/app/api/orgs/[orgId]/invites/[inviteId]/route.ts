/** DELETE /api/orgs/[orgId]/invites/[inviteId] — revoke a pending invite. */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgAccess } from "@/lib/authz";

type Params = Promise<{ orgId: string; inviteId: string }>;

export async function DELETE(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { orgId, inviteId } = await params;
  const denied = await requireOrgAccess(orgId, "manage");
  if (denied) return denied;
  await prisma.organizationInvite.delete({
    where: { id: inviteId },
  });
  return NextResponse.json({ ok: true });
}
