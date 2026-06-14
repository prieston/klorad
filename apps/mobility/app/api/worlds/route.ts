/**
 * Mobility worlds — list + create.
 *
 *   GET  /api/worlds?projectId=<id>
 *     Lists the worlds for a project (operator-scope). The public
 *     `/w/<slug>` route in PR2 has its own resolver; this endpoint is
 *     for the backstage console only.
 *
 *   POST /api/worlds
 *     Body: { projectId, slug, name, description?, visibility? }
 *     Creates a draft world (`isPublished = false`). Slug is enforced
 *     unique per-project at the DB layer; we surface the conflict as a
 *     409 instead of leaking the Prisma error.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/authz";

/** Allowed slug characters — lowercase, digits, hyphen, length 2-40.
 *  Tight on purpose: this lands in the public URL + manifest scope. */
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

const CreateBody = z.object({
  projectId: z.string().min(1),
  slug: z
    .string()
    .min(2)
    .max(40)
    .regex(SLUG_RE, "Lowercase letters, digits, hyphen; must start + end alphanumeric."),
  name: z.string().min(1).max(80),
  description: z.string().max(280).optional(),
  visibility: z.enum(["public", "linkOnly", "authenticated"]).optional(),
});

export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }
  const denied = await requireProjectAccess(projectId, "read");
  if (denied) return denied;

  const worlds = await prisma.mobilityWorld.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      visibility: true,
      isPublished: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { devices: true } },
    },
  });

  return NextResponse.json({
    worlds: worlds.map((w) => ({
      ...w,
      publishedAt: w.publishedAt?.toISOString() ?? null,
      createdAt: w.createdAt.toISOString(),
      updatedAt: w.updatedAt.toISOString(),
      deviceCount: w._count.devices,
      _count: undefined,
    })),
  });
}

export async function POST(req: Request): Promise<NextResponse> {
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
  const { projectId, slug, name, description, visibility } = parsed.data;

  const denied = await requireProjectAccess(projectId, "write");
  if (denied) return denied;

  try {
    const world = await prisma.mobilityWorld.create({
      data: {
        projectId,
        slug,
        name,
        description,
        visibility: visibility ?? "linkOnly",
      },
      select: { id: true, slug: true },
    });
    return NextResponse.json({ world }, { status: 201 });
  } catch (err) {
    // P2002 = unique constraint violation. `(projectId, slug)` is the
    // only unique key on this table, so this means slug-in-use.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A world with that slug already exists in this project." },
        { status: 409 },
      );
    }
    throw err;
  }
}
