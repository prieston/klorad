/**
 * PATCH  /api/orgs/[orgId]/members/[userId] — change role.
 * DELETE /api/orgs/[orgId]/members/[userId] — remove from org.
 *
 * Owners are protected: the last owner can't be demoted or removed.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgAccess } from "@/lib/authz";
import type { OrganizationRole } from "@prisma/client";

type Params = Promise<{ orgId: string; userId: string }>;

const PatchBody = z.object({
  role: z.enum(["owner", "admin", "member", "publicViewer"]),
});

async function ensureNotLastOwner(
  orgId: string,
  userId: string,
): Promise<NextResponse | null> {
  const ownerCount = await prisma.organizationMember.count({
    where: { organizationId: orgId, role: "owner" },
  });
  if (ownerCount > 1) return null;
  const target = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: { organizationId: orgId, userId },
    },
    select: { role: true },
  });
  if (target?.role === "owner") {
    return NextResponse.json(
      { error: "Can't remove or demote the last owner" },
      { status: 409 },
    );
  }
  return null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { orgId, userId } = await params;
  const denied = await requireOrgAccess(orgId, "manage");
  if (denied) return denied;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = PatchBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  if (parsed.data.role !== "owner") {
    const protect = await ensureNotLastOwner(orgId, userId);
    if (protect) return protect;
  }

  await prisma.organizationMember.update({
    where: {
      organizationId_userId: { organizationId: orgId, userId },
    },
    data: { role: parsed.data.role as OrganizationRole },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { orgId, userId } = await params;
  const denied = await requireOrgAccess(orgId, "manage");
  if (denied) return denied;
  const protect = await ensureNotLastOwner(orgId, userId);
  if (protect) return protect;
  await prisma.organizationMember.delete({
    where: { organizationId_userId: { organizationId: orgId, userId } },
  });
  return NextResponse.json({ ok: true });
}
