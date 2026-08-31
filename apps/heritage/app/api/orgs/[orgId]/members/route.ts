/**
 * GET  /api/orgs/[orgId]/members  — list members + open invites.
 * POST /api/orgs/[orgId]/members  — create an invite (returns
 *                                   `inviteUrl`; email delivery TBD).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireOrgAccess } from "@/lib/authz";
import { OrganizationRole } from "@prisma/client";

type Params = Promise<{ orgId: string }>;

const VALID_ROLES: OrganizationRole[] = [
  "owner",
  "admin",
  "member",
  "publicViewer",
];

const InviteBody = z.object({
  email: z.string().email(),
  role: z.enum(["owner", "admin", "member", "publicViewer"]).default("member"),
});

export async function GET(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { orgId } = await params;
  const denied = await requireOrgAccess(orgId, "read");
  if (denied) return denied;

  const [members, invites, mineRow] = await Promise.all([
    prisma.organizationMember.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        userId: true,
        role: true,
        createdAt: true,
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    }),
    prisma.organizationInvite.findMany({
      where: { organizationId: orgId, expires: { gte: new Date() } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        role: true,
        expires: true,
        createdAt: true,
        token: true,
        invitedBy: { select: { name: true, email: true } },
      },
    }),
    (async () => {
      const session = await auth();
      if (!session?.user?.id) return null;
      return prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: orgId,
            userId: session.user.id,
          },
        },
        select: { role: true },
      });
    })(),
  ]);

  return NextResponse.json({
    members: members.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      createdAt: m.createdAt.toISOString(),
      user: m.user,
    })),
    invites: invites.map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      expires: i.expires.toISOString(),
      createdAt: i.createdAt.toISOString(),
      invitedBy: i.invitedBy?.name ?? i.invitedBy?.email ?? null,
      token: i.token,
    })),
    yourRole: mineRow?.role ?? null,
  });
}

export async function POST(
  req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { orgId } = await params;
  const denied = await requireOrgAccess(orgId, "manage");
  if (denied) return denied;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = InviteBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const email = parsed.data.email.trim().toLowerCase();
  const role = parsed.data.role as OrganizationRole;
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const isMember = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId: existingUser.id,
        },
      },
    });
    if (isMember) {
      return NextResponse.json(
        { error: "Already a member" },
        { status: 409 },
      );
    }
  }

  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const invite = await prisma.organizationInvite.upsert({
    where: { organizationId_email: { organizationId: orgId, email } },
    create: {
      organizationId: orgId,
      email,
      role,
      token,
      expires,
      invitedById: session.user.id as string,
    },
    update: {
      role,
      token,
      expires,
      invitedById: session.user.id as string,
    },
  });

  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3004";
  return NextResponse.json({
    id: invite.id,
    inviteUrl: `${base}/auth/invite/${token}`,
  });
}
