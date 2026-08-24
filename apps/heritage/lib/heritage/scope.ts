import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Cross-entity tenant checks.
 *
 * Route handlers already establish that the caller may write to *this* venue.
 * What they cannot assume is that the ids inside the request body belong to
 * it: a curator of venue A sending `{ spaceId: <venue B's space> }` would
 * otherwise create a row that quietly straddles two tenants. Prisma's foreign
 * keys accept it because the FK only says "a space exists", not "a space in
 * this venue exists".
 *
 * §9.1 lists tenant isolation as provable, with documented evidence (§7.5.3),
 * which is a claim these checks have to earn.
 */
export async function assertVenueScoped(
  venueId: string,
  refs: {
    spaceId?: string | null;
    periodId?: string | null;
    sceneId?: string | null;
    objectId?: string | null;
    representationId?: string | null;
    actorId?: string | null;
    tourId?: string | null;
  },
): Promise<NextResponse | null> {
  const checks: Array<[string | null | undefined, string, () => Promise<unknown>]> = [
    [refs.spaceId, "space", () =>
      prisma.heritageSpace.findFirst({ where: { id: refs.spaceId!, venueId }, select: { id: true } })],
    [refs.periodId, "period", () =>
      prisma.heritagePeriod.findFirst({ where: { id: refs.periodId!, venueId }, select: { id: true } })],
    [refs.sceneId, "scene", () =>
      prisma.heritageScene.findFirst({ where: { id: refs.sceneId!, venueId }, select: { id: true } })],
    [refs.objectId, "object", () =>
      prisma.heritageObject.findFirst({ where: { id: refs.objectId!, venueId }, select: { id: true } })],
    [refs.representationId, "representation", () =>
      prisma.heritageRepresentation.findFirst({ where: { id: refs.representationId!, venueId }, select: { id: true } })],
    [refs.actorId, "actor", () =>
      prisma.heritageActor.findFirst({ where: { id: refs.actorId!, venueId }, select: { id: true } })],
    [refs.tourId, "tour", () =>
      prisma.heritageTour.findFirst({ where: { id: refs.tourId!, venueId }, select: { id: true } })],
  ];

  for (const [value, label, lookup] of checks) {
    if (!value) continue;
    const hit = await lookup();
    if (!hit) {
      return NextResponse.json(
        { error: `That ${label} does not belong to this venue` },
        { status: 400 },
      );
    }
  }
  return null;
}
