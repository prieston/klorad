import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { OrganizationRole } from "@prisma/client";
import { randomBytes } from "crypto";
import { sendOrgInviteEmail } from "@/lib/email";

const VALID_ROLES: OrganizationRole[] = ["owner", "admin", "member", "publicViewer"];

function generateToken() {
  return randomBytes(32).toString("hex");
}

/**
 * POST: create a pending invite. Email delivery is not yet wired on the
 * campus app — the response includes the invite URL so the owner can share
 * it manually. TODO: port the editor's Resend integration once email is
 * needed in production.
 */
export async function POST(
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
    email?: string;
    role?: string;
  };
  const email = body.email?.trim().toLowerCase();
  const role = body.role ?? "member";

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
  }
  if (!VALID_ROLES.includes(role as OrganizationRole)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const organization = await prisma.organization.findUnique({
    where: { id: orgId },
    include: { members: { where: { userId } } },
  });
  if (!organization) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }
  const membership = organization.members[0];
  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return NextResponse.json(
      { error: "Only owners and admins can invite members" },
      { status: 403 }
    );
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const isMember = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId: orgId, userId: existingUser.id },
      },
    });
    if (isMember) {
      return NextResponse.json(
        { error: "User is already a member of this organization" },
        { status: 409 }
      );
    }
  }

  const existingInvite = await prisma.organizationInvite.findUnique({
    where: { organizationId_email: { organizationId: orgId, email } },
  });
  if (existingInvite && existingInvite.expires > new Date()) {
    return NextResponse.json(
      { error: "Invitation already sent to this email" },
      { status: 409 }
    );
  }

  const token = generateToken();
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await prisma.organizationInvite.upsert({
    where: {
      organizationId_email: { organizationId: orgId, email },
    },
    create: {
      organizationId: orgId,
      email,
      role: role as OrganizationRole,
      token,
      expires,
      invitedById: userId,
    },
    update: { token, expires, invitedById: userId },
  });

  // Build a shareable accept URL — also the email's CTA, and the
  // fallback the owner pastes manually when email isn't configured.
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    new URL(req.url).origin;
  const inviteUrl = `${appUrl}/orgs/invites/accept?token=${token}`;

  // Best-effort email — returns { sent: false } if Resend isn't
  // configured, in which case the owner shares `inviteUrl` manually.
  const { sent } = await sendOrgInviteEmail({
    to: email,
    orgName: organization.name,
    inviterName: session.user.name ?? session.user.email ?? "A teammate",
    inviteUrl,
  });

  return NextResponse.json({
    message: sent ? "Invitation emailed" : "Invitation created",
    inviteUrl,
    emailed: sent,
  });
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
  const body = (await req.json().catch(() => ({}))) as { inviteId?: string };
  const { inviteId } = body;

  if (!inviteId) {
    return NextResponse.json({ error: "Invite ID is required" }, { status: 400 });
  }

  const membership = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: orgId, userId } },
  });
  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return NextResponse.json(
      { error: "Only owners and admins can cancel invitations" },
      { status: 403 }
    );
  }

  const invite = await prisma.organizationInvite.findUnique({
    where: { id: inviteId },
  });
  if (!invite || invite.organizationId !== orgId) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }

  await prisma.organizationInvite.delete({ where: { id: inviteId } });
  return NextResponse.json({ message: "Invitation cancelled" });
}
