/**
 * GET  /api/worlds/[worldId]/principals — list access grants (users
 *                                          and teams) with denormalised
 *                                          display info.
 * POST /api/worlds/[worldId]/principals — add a grant. Body is
 *   `{ kind: "user", userId }` or `{ kind: "team", teamId }`. The
 *   subject must belong to the world's org, and duplicates are a
 *   no-op returning the existing row.
 *
 * Requires project `write` access — same bar as broadcast.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/authz";
import { Prisma } from "@prisma/client";

type Params = Promise<{ worldId: string }>;

const AddBody = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("user"), userId: z.string().min(1) }),
  z.object({ kind: z.literal("team"), teamId: z.string().min(1) }),
]);

async function loadWorldOrDeny(worldId: string) {
  return prisma.mobilityWorld.findUnique({
    where: { id: worldId },
    select: {
      projectId: true,
      project: { select: { organizationId: true } },
    },
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { worldId } = await params;
  const world = await loadWorldOrDeny(worldId);
  if (!world) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = await requireProjectAccess(world.projectId, "read");
  if (denied) return denied;

  const rows = await prisma.mobilityWorldPrincipal.findMany({
    where: { worldId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      kind: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true, image: true } },
      team: {
        select: {
          id: true,
          name: true,
          _count: { select: { members: true } },
        },
      },
    },
  });
  return NextResponse.json({
    principals: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      createdAt: r.createdAt.toISOString(),
      user: r.user,
      team: r.team
        ? { id: r.team.id, name: r.team.name, memberCount: r.team._count.members }
        : null,
    })),
  });
}

export async function POST(
  req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { worldId } = await params;
  const world = await loadWorldOrDeny(worldId);
  if (!world) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = await requireProjectAccess(world.projectId, "write");
  if (denied) return denied;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = AddBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // Enforce that the subject belongs to the world's organisation.
  // Without this, an operator with write access to a project could
  // grant access to any user or team by id — a subtle privilege
  // escalation across orgs.
  if (parsed.data.kind === "user") {
    const inOrg = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: world.project.organizationId,
          userId: parsed.data.userId,
        },
      },
      select: { userId: true },
    });
    if (!inOrg) {
      return NextResponse.json(
        { error: "User is not a member of this organisation" },
        { status: 400 },
      );
    }
  } else {
    const team = await prisma.team.findFirst({
      where: {
        id: parsed.data.teamId,
        organizationId: world.project.organizationId,
      },
      select: { id: true },
    });
    if (!team) {
      return NextResponse.json(
        { error: "Team not found in this organisation" },
        { status: 400 },
      );
    }
  }

  try {
    const row = await prisma.mobilityWorldPrincipal.create({
      data:
        parsed.data.kind === "user"
          ? { worldId, kind: "user", userId: parsed.data.userId }
          : { worldId, kind: "team", teamId: parsed.data.teamId },
      select: {
        id: true,
        kind: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true, image: true } },
        team: {
          select: {
            id: true,
            name: true,
            _count: { select: { members: true } },
          },
        },
      },
    });
    return NextResponse.json({
      id: row.id,
      kind: row.kind,
      createdAt: row.createdAt.toISOString(),
      user: row.user,
      team: row.team
        ? { id: row.team.id, name: row.team.name, memberCount: row.team._count.members }
        : null,
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      // Idempotent — return the existing row.
      const existing = await prisma.mobilityWorldPrincipal.findFirst({
        where:
          parsed.data.kind === "user"
            ? { worldId, kind: "user", userId: parsed.data.userId }
            : { worldId, kind: "team", teamId: parsed.data.teamId },
        select: {
          id: true,
          kind: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true, image: true } },
          team: {
            select: {
              id: true,
              name: true,
              _count: { select: { members: true } },
            },
          },
        },
      });
      if (existing) {
        return NextResponse.json({
          id: existing.id,
          kind: existing.kind,
          createdAt: existing.createdAt.toISOString(),
          user: existing.user,
          team: existing.team
            ? {
                id: existing.team.id,
                name: existing.team.name,
                memberCount: existing.team._count.members,
              }
            : null,
        });
      }
    }
    throw err;
  }
}
