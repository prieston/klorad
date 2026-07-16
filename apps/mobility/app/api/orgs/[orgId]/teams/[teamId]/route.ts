/**
 * GET    /api/orgs/[orgId]/teams/[teamId] — team detail + members.
 * PATCH  /api/orgs/[orgId]/teams/[teamId] — rename / re-describe.
 * DELETE /api/orgs/[orgId]/teams/[teamId] — drop the team (cascades
 *                                             members + world grants).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgAccess } from "@/lib/authz";
import { Prisma } from "@prisma/client";

type Params = Promise<{ orgId: string; teamId: string }>;

const PatchBody = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(500).nullable().optional(),
});

async function loadScopedTeam(orgId: string, teamId: string) {
  return prisma.team.findFirst({
    where: { id: teamId, organizationId: orgId },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      members: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          userId: true,
          createdAt: true,
          user: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
      },
    },
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { orgId, teamId } = await params;
  const denied = await requireOrgAccess(orgId, "read");
  if (denied) return denied;

  const team = await loadScopedTeam(orgId, teamId);
  if (!team) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    id: team.id,
    name: team.name,
    description: team.description,
    createdAt: team.createdAt.toISOString(),
    members: team.members.map((m) => ({
      id: m.id,
      userId: m.userId,
      createdAt: m.createdAt.toISOString(),
      user: m.user,
    })),
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { orgId, teamId } = await params;
  const denied = await requireOrgAccess(orgId, "manage");
  if (denied) return denied;

  const exists = await prisma.team.findFirst({
    where: { id: teamId, organizationId: orgId },
    select: { id: true },
  });
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

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

  try {
    const updated = await prisma.team.update({
      where: { id: teamId },
      data: parsed.data,
      select: { id: true, name: true, description: true },
    });
    return NextResponse.json(updated);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A team with that name already exists" },
        { status: 409 },
      );
    }
    throw err;
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { orgId, teamId } = await params;
  const denied = await requireOrgAccess(orgId, "manage");
  if (denied) return denied;

  const exists = await prisma.team.findFirst({
    where: { id: teamId, organizationId: orgId },
    select: { id: true },
  });
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.team.delete({ where: { id: teamId } });
  return NextResponse.json({ ok: true });
}
