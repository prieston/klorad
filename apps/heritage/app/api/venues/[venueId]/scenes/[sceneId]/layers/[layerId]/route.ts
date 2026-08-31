/**
 * PATCH  /api/venues/[venueId]/scenes/[sceneId]/layers/[layerId]
 * DELETE /api/venues/[venueId]/scenes/[sceneId]/layers/[layerId]
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireVenueAccess } from "@/lib/authz";
import { guarded, notFound, readJson, transformSchema } from "@/lib/heritage/crud";

type Params = Promise<{ venueId: string; sceneId: string; layerId: string }>;

const ROLES = ["base", "overlay", "object", "proxy_source", "environment"] as const;

const PatchBody = z
  .object({
    role: z.enum(ROLES),
    transform: transformSchema.nullable(),
    sortOrder: z.number().int(),
    isVisible: z.boolean(),
  })
  .partial();

/** Layers are only reachable through a scene that belongs to this venue, so
 *  the tenant check is the scene lookup rather than a lookup per layer. */
async function ownScene(venueId: string, sceneId: string) {
  return prisma.heritageScene.findFirst({
    where: { id: sceneId, venueId },
    select: { id: true },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { venueId, sceneId, layerId } = await params;
  const access = await requireVenueAccess(venueId, "write");
  if (access.denied) return access.denied;
  if (!(await ownScene(venueId, sceneId))) return notFound();

  const parsed = await readJson(req, PatchBody);
  if ("error" in parsed) return parsed.error;

  return guarded(async () => {
    const { count } = await prisma.heritageSceneLayer.updateMany({
      where: { id: layerId, sceneId },
      data: parsed.data as never,
    });
    if (count === 0) return notFound();
    return NextResponse.json({ ok: true });
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { venueId, sceneId, layerId } = await params;
  const access = await requireVenueAccess(venueId, "write");
  if (access.denied) return access.denied;
  if (!(await ownScene(venueId, sceneId))) return notFound();

  return guarded(async () => {
    const { count } = await prisma.heritageSceneLayer.deleteMany({
      where: { id: layerId, sceneId },
    });
    if (count === 0) return notFound();
    return NextResponse.json({ ok: true });
  });
}
