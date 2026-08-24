/**
 * GET  /api/venues/[venueId]/scenes/[sceneId]/layers — the scene's composition.
 * POST /api/venues/[venueId]/scenes/[sceneId]/layers — add a representation to it.
 *
 * §5.2's strongest product story is a composition: a splat archaeological site
 * with mesh artifacts on plinths, or a splat gallery interior with mesh
 * display objects. That is what a layer is — one capture placed into one
 * scene with a transform.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireVenueAccess } from "@/lib/authz";
import {
  badRequest,
  guarded,
  notFound,
  readJson,
  serialiseBigInts,
  transformSchema,
} from "@/lib/heritage/crud";
import { assertVenueScoped } from "@/lib/heritage/scope";

type Params = Promise<{ venueId: string; sceneId: string }>;

const ROLES = ["base", "overlay", "object", "proxy_source", "environment"] as const;

export async function GET(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { venueId, sceneId } = await params;
  const access = await requireVenueAccess(venueId, "read");
  if (access.denied) return access.denied;

  const scene = await prisma.heritageScene.findFirst({
    where: { id: sceneId, venueId },
    select: { id: true },
  });
  if (!scene) return notFound();

  const layers = await prisma.heritageSceneLayer.findMany({
    where: { sceneId },
    orderBy: { sortOrder: "asc" },
    include: { representation: { include: { files: true } } },
  });
  return NextResponse.json(serialiseBigInts({ layers }));
}

const CreateBody = z.object({
  representationId: z.string().min(1),
  role: z.enum(ROLES).default("base"),
  transform: transformSchema.optional(),
  sortOrder: z.number().int().default(0),
  isVisible: z.boolean().default(true),
});

export async function POST(
  req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { venueId, sceneId } = await params;
  const access = await requireVenueAccess(venueId, "write");
  if (access.denied) return access.denied;

  const parsed = await readJson(req, CreateBody);
  if ("error" in parsed) return parsed.error;

  const scopeError = await assertVenueScoped(venueId, {
    sceneId,
    representationId: parsed.data.representationId,
  });
  if (scopeError) return scopeError;

  // §9.2: never a full splat budget and a full mesh budget in one scene — one
  // dominant representation per scene. A second `base` layer is how that rule
  // gets broken by accident, so it is refused rather than warned about.
  if (parsed.data.role === "base") {
    const existingBase = await prisma.heritageSceneLayer.findFirst({
      where: { sceneId, role: "base" },
      select: { id: true },
    });
    if (existingBase) {
      return badRequest(
        "This scene already has a base layer. One dominant representation per scene — add the other as an object or overlay layer.",
      );
    }
  }

  return guarded(async () => {
    const layer = await prisma.heritageSceneLayer.create({
      data: { sceneId, ...parsed.data } as never,
      select: { id: true },
    });
    return NextResponse.json(layer, { status: 201 });
  });
}
