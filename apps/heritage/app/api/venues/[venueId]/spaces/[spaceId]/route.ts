/**
 * GET / PATCH / DELETE a single Space.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireVenueAccess } from "@/lib/authz";
import {
  guarded,
  localized,
  notFound,
  readJson,
  slugSchema,
} from "@/lib/heritage/crud";

type Params = Promise<{ venueId: string; spaceId: string }>;

const SPACE_KINDS = [
  "gallery",
  "room",
  "sector",
  "scanned_scene",
  "exterior",
  "storage",
] as const;
const STATES = ["draft", "in_review", "approved", "published", "archived"] as const;

export async function GET(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { venueId, spaceId } = await params;
  const access = await requireVenueAccess(venueId, "read");
  if (access.denied) return access.denied;

  // Scoped by venueId as well as id: an authorised curator of venue A must
  // not be able to read venue B's space by guessing its id.
  const space = await prisma.heritageSpace.findFirst({
    where: { id: spaceId, venueId },
    include: { scenes: { select: { id: true, slug: true, title: true, kind: true } } },
  });
  if (!space) return notFound();
  return NextResponse.json({ space });
}

const PatchBody = z
  .object({
    slug: slugSchema,
    name: localized,
    description: localized.nullable(),
    kind: z.enum(SPACE_KINDS),
    floor: z.number().int().nullable(),
    sortOrder: z.number().int(),
    state: z.enum(STATES),
  })
  .partial();

export async function PATCH(
  req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { venueId, spaceId } = await params;
  const access = await requireVenueAccess(venueId, "write");
  if (access.denied) return access.denied;

  const parsed = await readJson(req, PatchBody);
  if ("error" in parsed) return parsed.error;

  return guarded(async () => {
    const { count } = await prisma.heritageSpace.updateMany({
      where: { id: spaceId, venueId },
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
  const { venueId, spaceId } = await params;
  const access = await requireVenueAccess(venueId, "manage");
  if (access.denied) return access.denied;

  return guarded(async () => {
    const { count } = await prisma.heritageSpace.deleteMany({
      where: { id: spaceId, venueId },
    });
    if (count === 0) return notFound();
    return NextResponse.json({ ok: true });
  });
}
