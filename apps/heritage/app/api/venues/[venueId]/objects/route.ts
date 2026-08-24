/**
 * GET  /api/venues/[venueId]/objects — list heritage objects.
 * POST /api/venues/[venueId]/objects — create one.
 *
 * A HeritageObject is the **physical original** and is never conflated with a
 * digital file of it (§8 modelling rule 1). Rights recorded here govern the
 * original; each Representation carries its own, and reads resolve to the
 * more restrictive of the two via lib/heritage/rights.ts.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireVenueAccess } from "@/lib/authz";
import { guarded, localized, readJson, slugSchema } from "@/lib/heritage/crud";
import { assertVenueScoped } from "@/lib/heritage/scope";
import { ALL_RIGHTS } from "@/lib/heritage/rights";

type Params = Promise<{ venueId: string }>;

export async function GET(
  req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { venueId } = await params;
  const access = await requireVenueAccess(venueId, "read");
  if (access.denied) return access.denied;

  const url = new URL(req.url);
  const spaceId = url.searchParams.get("spaceId");
  const state = url.searchParams.get("state");

  const objects = await prisma.heritageObject.findMany({
    where: {
      venueId,
      ...(spaceId ? { spaceId } : {}),
      ...(state ? { state: state as never } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: {
      _count: { select: { representations: true, proxies: true } },
      period: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json({ objects });
}

const CreateBody = z.object({
  slug: slugSchema,
  title: localized,
  description: localized.optional(),
  creditLine: localized.optional(),
  identifier: z.string().max(120).optional(),
  objectType: z.string().max(160).optional(),
  materials: z.array(z.string().max(80)).default([]),
  dimensions: z.record(z.string(), z.unknown()).optional(),
  provenance: z.record(z.string(), z.unknown()).optional(),
  currentLocation: z.record(z.string(), z.unknown()).optional(),
  spaceId: z.string().nullable().optional(),
  periodId: z.string().nullable().optional(),
  rights: z.enum(ALL_RIGHTS as [string, ...string[]]).nullable().optional(),
  rightsHolder: z.string().max(200).nullable().optional(),
  externalUri: z.string().url().nullable().optional(),
  cmsSourceId: z.string().max(200).nullable().optional(),
  sortOrder: z.number().int().default(0),
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

  // A space or period from another venue would silently break tenant
  // isolation, so verify both belong here before writing.
  const scopeError = await assertVenueScoped(venueId, parsed.data);
  if (scopeError) return scopeError;

  return guarded(async () => {
    const object = await prisma.heritageObject.create({
      data: { venueId, ...parsed.data } as never,
      select: { id: true, slug: true },
    });
    return NextResponse.json(object, { status: 201 });
  });
}
