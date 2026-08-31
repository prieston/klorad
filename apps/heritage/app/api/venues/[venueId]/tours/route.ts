/**
 * GET  /api/venues/[venueId]/tours — list tours.
 * POST /api/venues/[venueId]/tours — create one.
 *
 * §7.1.4: one tour definition drives both the on-screen virtual tour and the
 * in-headset guided walk. Stops are managed through the tour item route.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireVenueAccess } from "@/lib/authz";
import { guarded, localized, readJson, slugSchema } from "@/lib/heritage/crud";

type Params = Promise<{ venueId: string }>;

const MODES = ["screen", "headset", "both"] as const;

export async function GET(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { venueId } = await params;
  const access = await requireVenueAccess(venueId, "read");
  if (access.denied) return access.denied;

  const tours = await prisma.heritageTour.findMany({
    where: { venueId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: { _count: { select: { stops: true } } },
  });
  return NextResponse.json({ tours });
}

const CreateBody = z.object({
  slug: slugSchema,
  title: localized,
  description: localized.optional(),
  mode: z.enum(MODES).default("both"),
  estimatedMinutes: z.number().int().positive().nullable().optional(),
  isAccessibleRoute: z.boolean().default(false),
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
    const tour = await prisma.heritageTour.create({
      data: { venueId, ...parsed.data } as never,
      select: { id: true, slug: true },
    });
    return NextResponse.json(tour, { status: 201 });
  });
}
