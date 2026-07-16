/**
 * GET  /api/orgs/[orgId]/teams — list teams in the org with member
 *                                 counts, ordered oldest-first so the
 *                                 UI has stable ordering across polls.
 * POST /api/orgs/[orgId]/teams — create a team. Requires `manage`
 *                                 (same bar as inviting members).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrgAccess } from "@/lib/authz";
import { Prisma } from "@prisma/client";

type Params = Promise<{ orgId: string }>;

const CreateBody = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional().nullable(),
});

export async function GET(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { orgId } = await params;
  const denied = await requireOrgAccess(orgId, "read");
  if (denied) return denied;

  const teams = await prisma.team.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      _count: { select: { members: true } },
    },
  });
  return NextResponse.json({
    teams: teams.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      memberCount: t._count.members,
      createdAt: t.createdAt.toISOString(),
    })),
  });
}

export async function POST(
  req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { orgId } = await params;
  const denied = await requireOrgAccess(orgId, "manage");
  if (denied) return denied;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = CreateBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const team = await prisma.team.create({
      data: {
        organizationId: orgId,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
      },
      select: { id: true, name: true, description: true, createdAt: true },
    });
    return NextResponse.json({
      id: team.id,
      name: team.name,
      description: team.description,
      memberCount: 0,
      createdAt: team.createdAt.toISOString(),
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A team with that name already exists in this organisation" },
        { status: 409 },
      );
    }
    throw err;
  }
}
