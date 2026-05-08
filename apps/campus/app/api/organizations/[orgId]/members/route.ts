import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { OrganizationRole } from "@prisma/client";

const VALID_ROLES: OrganizationRole[] = ["owner", "admin", "member", "publicViewer"];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id as string;
  const { orgId } = await params;

  const userMembership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId } },
  });
  if (!userMembership) {
    return NextResponse.json(
      { error: "You are not a member of this organization" },
      { status: 403 }
    );
  }

  const organization = await prisma.organization.findUnique({
    where: { id: orgId },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      invites: {
        where: { expires: { gte: new Date() } },
        include: { invitedBy: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!organization) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  return NextResponse.json({
    members: organization.members.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      createdAt: m.createdAt.toISOString(),
      user: {
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        image: m.user.image,
      },
    })),
    invites: organization.invites.map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      expires: i.expires.toISOString(),
      createdAt: i.createdAt.toISOString(),
      invitedBy: i.invitedBy.name || i.invitedBy.email,
    })),
    userRole: userMembership.role,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id as string;
  const { orgId } = await params;

  const body = (await req.json().catch(() => ({}))) as {
    memberId?: string;
    role?: string;
  };
  const { memberId, role } = body;
  if (!memberId) {
    return NextResponse.json({ error: "Member ID is required" }, { status: 400 });
  }
  if (!role || !VALID_ROLES.includes(role as OrganizationRole)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const userMembership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId } },
  });
  if (!userMembership || userMembership.role !== "owner") {
    return NextResponse.json(
      { error: "Only owners can update member roles" },
      { status: 403 }
    );
  }

  const target = await prisma.organizationMember.findUnique({
    where: { id: memberId },
  });
  if (!target || target.organizationId !== orgId) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }
  if (target.userId === userId) {
    return NextResponse.json(
      { error: "You cannot change your own role" },
      { status: 400 }
    );
  }
  if (target.role === "owner" && role !== "owner") {
    const ownerCount = await prisma.organizationMember.count({
      where: { organizationId: orgId, role: "owner" },
    });
    if (ownerCount <= 1) {
      return NextResponse.json(
        { error: "Cannot change the last owner's role" },
        { status: 400 }
      );
    }
  }

  const updated = await prisma.organizationMember.update({
    where: { id: memberId },
    data: { role: role as OrganizationRole },
  });
  return NextResponse.json({ message: "Member role updated", member: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id as string;
  const { orgId } = await params;
  const body = (await req.json().catch(() => ({}))) as { memberId?: string };
  const { memberId } = body;
  if (!memberId) {
    return NextResponse.json({ error: "Member ID is required" }, { status: 400 });
  }

  const userMembership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId } },
  });
  if (!userMembership || userMembership.role !== "owner") {
    return NextResponse.json(
      { error: "Only owners can remove members" },
      { status: 403 }
    );
  }

  const target = await prisma.organizationMember.findUnique({
    where: { id: memberId },
  });
  if (!target || target.organizationId !== orgId) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }
  if (target.userId === userId) {
    return NextResponse.json({ error: "You cannot remove yourself" }, { status: 400 });
  }
  if (target.role === "owner") {
    const ownerCount = await prisma.organizationMember.count({
      where: { organizationId: orgId, role: "owner" },
    });
    if (ownerCount <= 1) {
      return NextResponse.json(
        { error: "Cannot remove the last owner" },
        { status: 400 }
      );
    }
  }

  await prisma.organizationMember.delete({ where: { id: memberId } });
  return NextResponse.json({ message: "Member removed" });
}
