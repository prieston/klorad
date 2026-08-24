/**
 * GET / PATCH / DELETE a single HeritageObject.
 *
 * The GET returns each representation alongside its **resolved** rights —
 * object rights and representation rights reconciled through the venue's
 * public-domain-scan policy (§7.2.6) — so no caller has to reimplement that
 * rule and get it subtly wrong.
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
  serialiseBigInts,
  slugSchema,
} from "@/lib/heritage/crud";
import { ALL_RIGHTS, applyScanPolicy } from "@/lib/heritage/rights";
import { assertVenueScoped } from "@/lib/heritage/scope";

type Params = Promise<{ venueId: string; objectId: string }>;

const STATES = ["draft", "in_review", "approved", "published", "archived"] as const;

export async function GET(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { venueId, objectId } = await params;
  const access = await requireVenueAccess(venueId, "read");
  if (access.denied) return access.denied;

  const [object, venue] = await Promise.all([
    prisma.heritageObject.findFirst({
      where: { id: objectId, venueId },
      include: {
        period: true,
        space: { select: { id: true, slug: true, name: true } },
        events: { orderBy: { startDate: "asc" } },
        representations: {
          include: { files: true, paradata: true },
          orderBy: { createdAt: "asc" },
        },
        proxies: { select: { id: true, sceneId: true, invalidatedAt: true } },
      },
    }),
    prisma.heritageVenue.findUnique({
      where: { id: venueId },
      select: { scanOfPublicDomainAssertsRights: true },
    }),
  ]);
  if (!object || !venue) return notFound();

  const representations = object.representations.map((rep) => ({
    ...rep,
    resolvedRights: applyScanPolicy(
      object.rights,
      rep.rights,
      venue.scanOfPublicDomainAssertsRights,
    ),
  }));

  return NextResponse.json(
    serialiseBigInts({ object: { ...object, representations } }),
  );
}

const PatchBody = z
  .object({
    slug: slugSchema,
    title: localized,
    description: localized.nullable(),
    creditLine: localized.nullable(),
    identifier: z.string().max(120).nullable(),
    objectType: z.string().max(160).nullable(),
    materials: z.array(z.string().max(80)),
    dimensions: z.record(z.string(), z.unknown()).nullable(),
    provenance: z.record(z.string(), z.unknown()).nullable(),
    currentLocation: z.record(z.string(), z.unknown()).nullable(),
    spaceId: z.string().nullable(),
    periodId: z.string().nullable(),
    rights: z.enum(ALL_RIGHTS as [string, ...string[]]).nullable(),
    rightsHolder: z.string().max(200).nullable(),
    externalUri: z.string().url().nullable(),
    cmsSourceId: z.string().max(200).nullable(),
    sortOrder: z.number().int(),
    state: z.enum(STATES),
  })
  .partial();

export async function PATCH(
  req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { venueId, objectId } = await params;
  const access = await requireVenueAccess(venueId, "write");
  if (access.denied) return access.denied;

  const parsed = await readJson(req, PatchBody);
  if ("error" in parsed) return parsed.error;

  const scopeError = await assertVenueScoped(venueId, parsed.data);
  if (scopeError) return scopeError;

  return guarded(async () => {
    const { count } = await prisma.heritageObject.updateMany({
      where: { id: objectId, venueId },
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
  const { venueId, objectId } = await params;
  const access = await requireVenueAccess(venueId, "manage");
  if (access.denied) return access.denied;

  return guarded(async () => {
    const { count } = await prisma.heritageObject.deleteMany({
      where: { id: objectId, venueId },
    });
    if (count === 0) return notFound();
    return NextResponse.json({ ok: true });
  });
}
