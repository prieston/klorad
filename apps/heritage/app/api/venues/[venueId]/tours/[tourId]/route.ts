/**
 * GET / PATCH / DELETE a single Tour.
 *
 * PATCH accepts a full `stops` array and replaces the set. Tour stops are
 * ordered and small, and a curator reordering them in the builder produces one
 * intent, not N — so the endpoint takes the whole sequence rather than making
 * the client sequence a batch of per-stop writes that can half-apply.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireVenueAccess } from "@/lib/authz";
import {
  badRequest,
  guarded,
  localized,
  notFound,
  readJson,
  slugSchema,
  transformSchema,
} from "@/lib/heritage/crud";

type Params = Promise<{ venueId: string; tourId: string }>;

const MODES = ["screen", "headset", "both"] as const;
const STATES = ["draft", "in_review", "approved", "published", "archived"] as const;

export async function GET(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { venueId, tourId } = await params;
  const access = await requireVenueAccess(venueId, "read");
  if (access.denied) return access.denied;

  const tour = await prisma.heritageTour.findFirst({
    where: { id: tourId, venueId },
    include: {
      stops: {
        orderBy: { sortOrder: "asc" },
        include: {
          scene: { select: { id: true, slug: true, title: true } },
          object: { select: { id: true, slug: true, title: true } },
        },
      },
    },
  });
  if (!tour) return notFound();
  return NextResponse.json({ tour });
}

const StopInput = z.object({
  sceneId: z.string().nullable().optional(),
  objectId: z.string().nullable().optional(),
  title: localized,
  body: localized.optional(),
  cameraPose: transformSchema.optional(),
  audioRepresentationId: z.string().nullable().optional(),
  mediaRepresentationIds: z.array(z.string()).default([]),
});

const PatchBody = z
  .object({
    slug: slugSchema,
    title: localized,
    description: localized.nullable(),
    mode: z.enum(MODES),
    state: z.enum(STATES),
    estimatedMinutes: z.number().int().positive().nullable(),
    isAccessibleRoute: z.boolean(),
    sortOrder: z.number().int(),
    /** Replaces the stop sequence wholesale. Order in the array is the order
     *  the visitor walks; `sortOrder` is derived from the index. */
    stops: z.array(StopInput).max(200),
  })
  .partial();

export async function PATCH(
  req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { venueId, tourId } = await params;
  const access = await requireVenueAccess(venueId, "write");
  if (access.denied) return access.denied;

  const parsed = await readJson(req, PatchBody);
  if ("error" in parsed) return parsed.error;
  const { stops, ...fields } = parsed.data;

  const tour = await prisma.heritageTour.findFirst({
    where: { id: tourId, venueId },
    select: { id: true },
  });
  if (!tour) return notFound();

  if (stops) {
    // Every scene, object and representation a stop points at has to belong to
    // this venue. Collected and checked in one pass rather than per stop.
    const sceneIds = new Set<string>();
    const objectIds = new Set<string>();
    const repIds = new Set<string>();
    for (const s of stops) {
      if (s.sceneId) sceneIds.add(s.sceneId);
      if (s.objectId) objectIds.add(s.objectId);
      if (s.audioRepresentationId) repIds.add(s.audioRepresentationId);
      for (const id of s.mediaRepresentationIds) repIds.add(id);
    }
    const [scenes, objects, reps] = await Promise.all([
      prisma.heritageScene.count({ where: { venueId, id: { in: [...sceneIds] } } }),
      prisma.heritageObject.count({ where: { venueId, id: { in: [...objectIds] } } }),
      prisma.heritageRepresentation.count({
        where: { venueId, id: { in: [...repIds] } },
      }),
    ]);
    if (scenes !== sceneIds.size) return badRequest("A stop references a scene from another venue");
    if (objects !== objectIds.size) return badRequest("A stop references an object from another venue");
    if (reps !== repIds.size) return badRequest("A stop references media from another venue");
  }

  return guarded(async () => {
    await prisma.$transaction(async (tx) => {
      if (Object.keys(fields).length > 0) {
        await tx.heritageTour.update({
          where: { id: tourId },
          data: fields as never,
        });
      }
      if (stops) {
        await tx.heritageTourStop.deleteMany({ where: { tourId } });
        if (stops.length > 0) {
          await tx.heritageTourStop.createMany({
            data: stops.map((s, index) => ({
              tourId,
              sortOrder: index,
              ...s,
            })) as never,
          });
        }
      }
    });
    return NextResponse.json({ ok: true });
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { venueId, tourId } = await params;
  const access = await requireVenueAccess(venueId, "manage");
  if (access.denied) return access.denied;

  return guarded(async () => {
    const { count } = await prisma.heritageTour.deleteMany({
      where: { id: tourId, venueId },
    });
    if (count === 0) return notFound();
    return NextResponse.json({ ok: true });
  });
}
