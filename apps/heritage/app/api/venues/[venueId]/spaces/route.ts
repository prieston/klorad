/**
 * GET  /api/venues/[venueId]/spaces — list spaces in a venue.
 * POST /api/venues/[venueId]/spaces — create one.
 *
 * A Space is a gallery, sector, room or scanned scene (§8, CIDOC-CRM E53).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireVenueAccess } from "@/lib/authz";
import { guarded, localized, readJson, slugSchema } from "@/lib/heritage/crud";

type Params = Promise<{ venueId: string }>;

const SPACE_KINDS = [
  "gallery",
  "room",
  "sector",
  "scanned_scene",
  "exterior",
  "storage",
] as const;

export async function GET(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { venueId } = await params;
  const access = await requireVenueAccess(venueId, "read");
  if (access.denied) return access.denied;

  const spaces = await prisma.heritageSpace.findMany({
    where: { venueId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { scenes: true, objects: true } } },
  });
  return NextResponse.json({ spaces });
}

const CreateBody = z.object({
  slug: slugSchema,
  name: localized,
  description: localized.optional(),
  kind: z.enum(SPACE_KINDS).default("gallery"),
  floor: z.number().int().nullable().optional(),
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

  return guarded(async () => {
    const space = await prisma.heritageSpace.create({
      data: { venueId, ...parsed.data },
      select: { id: true, slug: true },
    });
    return NextResponse.json(space, { status: 201 });
  });
}
