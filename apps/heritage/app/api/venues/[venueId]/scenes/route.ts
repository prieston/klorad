/**
 * GET  /api/venues/[venueId]/scenes — list renderable scenes.
 * POST /api/venues/[venueId]/scenes — create one.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireVenueAccess } from "@/lib/authz";
import { guarded, localized, readJson, slugSchema } from "@/lib/heritage/crud";
import { assertVenueScoped } from "@/lib/heritage/scope";

type Params = Promise<{ venueId: string }>;

const KINDS = ["mesh", "splat", "composite", "panorama"] as const;

export async function GET(
  req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { venueId } = await params;
  const access = await requireVenueAccess(venueId, "read");
  if (access.denied) return access.denied;

  const spaceId = new URL(req.url).searchParams.get("spaceId");
  const scenes = await prisma.heritageScene.findMany({
    where: { venueId, ...(spaceId ? { spaceId } : {}) },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { layers: true, proxies: true, tourStops: true } },
      space: { select: { id: true, slug: true, name: true } },
    },
  });
  return NextResponse.json({ scenes });
}

const CreateBody = z.object({
  slug: slugSchema,
  title: localized,
  description: localized.optional(),
  kind: z.enum(KINDS).default("mesh"),
  spaceId: z.string().nullable().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { venueId } = await params;
  const access = await requireVenueAccess(venueId, "write");
  if (access.denied) return access.denied;

  const parsed = await readJson(req, CreateBody);
  if ("error" in parsed) return parsed.error;

  const scopeError = await assertVenueScoped(venueId, parsed.data);
  if (scopeError) return scopeError;

  return guarded(async () => {
    const scene = await prisma.heritageScene.create({
      data: { venueId, ...parsed.data } as never,
      select: { id: true, slug: true },
    });
    return NextResponse.json(scene, { status: 201 });
  });
}
