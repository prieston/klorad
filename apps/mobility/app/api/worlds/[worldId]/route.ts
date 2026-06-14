/**
 * One mobility world — read / update / delete.
 *
 *   GET    /api/worlds/[worldId]    — fetch + device-id list (small).
 *   PATCH  /api/worlds/[worldId]    — partial update. Slug is gated
 *                                      once `isPublished` is true to
 *                                      protect installed PWAs and
 *                                      push subscriptions; rename a
 *                                      published world only by
 *                                      unpublishing first.
 *   DELETE /api/worlds/[worldId]    — drops the world + cascades to
 *                                      MobilityWorldDevice rows.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/authz";

type Params = Promise<{ worldId: string }>;

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

const PatchBody = z.object({
  slug: z.string().min(2).max(40).regex(SLUG_RE).optional(),
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(280).nullable().optional(),
  visibility: z.enum(["public", "linkOnly", "authenticated"]).optional(),
  isPublished: z.boolean().optional(),
  theme: z.record(z.unknown()).optional(),
});

async function loadWorldProject(
  worldId: string,
): Promise<{ projectId: string; isPublished: boolean } | null> {
  const row = await prisma.mobilityWorld.findUnique({
    where: { id: worldId },
    select: { projectId: true, isPublished: true },
  });
  return row;
}

export async function GET(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { worldId } = await params;
  const meta = await loadWorldProject(worldId);
  if (!meta) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const denied = await requireProjectAccess(meta.projectId, "read");
  if (denied) return denied;

  const world = await prisma.mobilityWorld.findUnique({
    where: { id: worldId },
    include: { devices: { select: { deviceId: true } } },
  });
  if (!world) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    world: {
      ...world,
      publishedAt: world.publishedAt?.toISOString() ?? null,
      createdAt: world.createdAt.toISOString(),
      updatedAt: world.updatedAt.toISOString(),
      deviceIds: world.devices.map((d) => d.deviceId),
      devices: undefined,
    },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { worldId } = await params;
  const meta = await loadWorldProject(worldId);
  if (!meta) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const denied = await requireProjectAccess(meta.projectId, "write");
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

  // Slug + published toggling have side-effects worth gating.
  if (parsed.data.slug !== undefined && meta.isPublished) {
    return NextResponse.json(
      {
        error:
          "Unpublish the world before renaming its slug — installed PWAs and push subscriptions point at the current slug.",
      },
      { status: 409 },
    );
  }

  const data: Prisma.MobilityWorldUpdateInput = {};
  if (parsed.data.slug !== undefined) data.slug = parsed.data.slug;
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.description !== undefined) {
    data.description = parsed.data.description;
  }
  if (parsed.data.visibility !== undefined) {
    data.visibility = parsed.data.visibility;
  }
  if (parsed.data.theme !== undefined) {
    data.theme = parsed.data.theme as Prisma.InputJsonValue;
  }
  if (parsed.data.isPublished !== undefined) {
    data.isPublished = parsed.data.isPublished;
    // Stamp publishedAt on first publish; clear it on unpublish so the
    // UI shows the world reverted to draft.
    data.publishedAt = parsed.data.isPublished ? new Date() : null;
  }

  try {
    await prisma.mobilityWorld.update({ where: { id: worldId }, data });
  } catch (err) {
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

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { worldId } = await params;
  const meta = await loadWorldProject(worldId);
  if (!meta) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const denied = await requireProjectAccess(meta.projectId, "manage");
  if (denied) return denied;

  await prisma.mobilityWorld.delete({ where: { id: worldId } });
  return NextResponse.json({ ok: true });
}
