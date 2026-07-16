/**
 * POST /api/orgs/[orgId]/teams/[teamId]/members
 *   Add a user to a team. Body: `{ userId }`. The user must already be
 *   an OrganizationMember of the team's org — no cross-org grants.
 *
 *   Duplicate adds are a no-op (upsert-like), so the picker doesn't
 *   have to filter its list against already-added users.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgAccess } from "@/lib/authz";
import { Prisma } from "@prisma/client";

type Params = Promise<{ orgId: string; teamId: string }>;

const Body = z.object({
  userId: z.string().min(1),
});

export async function POST(
  req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { orgId, teamId } = await params;
  const denied = await requireOrgAccess(orgId, "manage");
  if (denied) return denied;

  const team = await prisma.team.findFirst({
    where: { id: teamId, organizationId: orgId },
    select: { id: true },
  });
  if (!team) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { userId } = parsed.data;

  const orgMembership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: { organizationId: orgId, userId },
    },
    select: { userId: true },
  });
  if (!orgMembership) {
    return NextResponse.json(
      { error: "User is not a member of this organisation" },
      { status: 400 },
    );
  }

  try {
    const member = await prisma.teamMember.create({
      data: { teamId, userId },
      select: {
        id: true,
        userId: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    });
    return NextResponse.json({
      id: member.id,
      userId: member.userId,
      createdAt: member.createdAt.toISOString(),
      user: member.user,
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      // Already a member — return the existing row so the client can
      // treat this as idempotent.
      const existing = await prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId } },
        select: {
          id: true,
          userId: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      });
      if (existing) {
        return NextResponse.json({
          id: existing.id,
          userId: existing.userId,
          createdAt: existing.createdAt.toISOString(),
          user: existing.user,
        });
      }
    }
    throw err;
  }
}
