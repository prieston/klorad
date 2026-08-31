/**
 * GET  /api/venues/[venueId]/representations — list captures.
 * POST /api/venues/[venueId]/representations — register one.
 *
 * A Representation is a digital thing *of* an object or a space, never the
 * thing itself (§8 modelling rule 1). Creating one starts at `pending`: the
 * row exists before its files do, because §7.2.1 requires large-file upload
 * that survives a dropped connection, which means the record has to outlive
 * the request that created it.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireVenueAccess } from "@/lib/authz";
import { guarded, localized, readJson, serialiseBigInts } from "@/lib/heritage/crud";
import { assertVenueScoped } from "@/lib/heritage/scope";
import { ALL_RIGHTS } from "@/lib/heritage/rights";

type Params = Promise<{ venueId: string }>;

const KINDS = [
  "mesh",
  "splat",
  "point_cloud",
  "image",
  "audio",
  "video",
  "panorama",
] as const;

export async function GET(
  req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { venueId } = await params;
  const access = await requireVenueAccess(venueId, "read");
  if (access.denied) return access.denied;

  const url = new URL(req.url);
  const objectId = url.searchParams.get("objectId");
  const spaceId = url.searchParams.get("spaceId");
  const status = url.searchParams.get("status");

  const representations = await prisma.heritageRepresentation.findMany({
    where: {
      venueId,
      ...(objectId ? { objectId } : {}),
      ...(spaceId ? { spaceId } : {}),
      ...(status ? { status: status as never } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { files: true, paradata: true },
  });
  return NextResponse.json(serialiseBigInts({ representations }));
}

const CreateBody = z.object({
  kind: z.enum(KINDS),
  label: localized.optional(),
  objectId: z.string().nullable().optional(),
  spaceId: z.string().nullable().optional(),
  rights: z.enum(ALL_RIGHTS as [string, ...string[]]).nullable().optional(),
  rightsHolder: z.string().max(200).nullable().optional(),
  rightsNote: z.string().max(2000).nullable().optional(),
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
    const representation = await prisma.heritageRepresentation.create({
      data: { venueId, ...parsed.data } as never,
      select: { id: true, status: true },
    });
    return NextResponse.json(representation, { status: 201 });
  });
}
