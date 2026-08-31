/**
 * GET    /api/venues/[venueId] — one venue, with counts. Feeds the sidebar
 *                                context header and the venue overview.
 * PATCH  /api/venues/[venueId] — update venue settings.
 * DELETE /api/venues/[venueId] — delete the venue and its Project.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireVenueAccess } from "@/lib/authz";
import { guarded, localized, notFound, readJson, slugSchema } from "@/lib/heritage/crud";
import { pickLocalized } from "@/lib/heritage/i18n";
import { ALL_RIGHTS } from "@/lib/heritage/rights";

type Params = Promise<{ venueId: string }>;

const VENUE_KINDS = [
  "museum",
  "archaeological_site",
  "monument",
  "collection",
  "cultural_route",
] as const;

export async function GET(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { venueId } = await params;
  const access = await requireVenueAccess(venueId, "read");
  if (access.denied) return access.denied;

  const venue = await prisma.heritageVenue.findUnique({
    where: { id: venueId },
    include: {
      project: { select: { id: true, isPublished: true, organizationId: true } },
      _count: {
        select: {
          spaces: true,
          scenes: true,
          objects: true,
          representations: true,
          proxies: true,
          tours: true,
        },
      },
    },
  });
  if (!venue) return notFound();

  return NextResponse.json({
    venue: {
      id: venue.id,
      projectId: venue.project.id,
      organizationId: venue.project.organizationId,
      slug: venue.slug,
      kind: venue.kind,
      // Resolved for display; `nameLocalized` carries the full map for the
      // settings form, which has to be able to edit every language.
      name: pickLocalized(venue.name, venue.defaultLanguage, "en"),
      nameLocalized: venue.name,
      summaryLocalized: venue.summary,
      languages: venue.languages,
      defaultLanguage: venue.defaultLanguage,
      latitude: venue.latitude,
      longitude: venue.longitude,
      timezone: venue.timezone,
      address: venue.address,
      scanOfPublicDomainAssertsRights: venue.scanOfPublicDomainAssertsRights,
      defaultRights: venue.defaultRights,
      isPublished: venue.project.isPublished,
      createdAt: venue.createdAt.toISOString(),
      counts: venue._count,
    },
  });
}

const PatchBody = z
  .object({
    name: localized,
    summary: localized.nullable(),
    slug: slugSchema,
    kind: z.enum(VENUE_KINDS),
    languages: z.array(z.string().min(2).max(35)).min(1),
    defaultLanguage: z.string().min(2).max(35),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    timezone: z.string().nullable(),
    address: z.record(z.string(), z.unknown()).nullable(),
    scanOfPublicDomainAssertsRights: z.boolean(),
    defaultRights: z.enum(ALL_RIGHTS as [string, ...string[]]),
    isPublished: z.boolean(),
  })
  .partial();

export async function PATCH(
  req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { venueId } = await params;
  const access = await requireVenueAccess(venueId, "write");
  if (access.denied) return access.denied;

  const parsed = await readJson(req, PatchBody);
  if ("error" in parsed) return parsed.error;
  const { isPublished, ...venueFields } = parsed.data;

  // A default language outside the venue's language set would make
  // `pickLocalized` fall through on every read, so reject it here rather than
  // letting it degrade quietly.
  if (venueFields.defaultLanguage || venueFields.languages) {
    const current = await prisma.heritageVenue.findUnique({
      where: { id: venueId },
      select: { languages: true, defaultLanguage: true },
    });
    if (!current) return notFound();
    const languages = venueFields.languages ?? current.languages;
    const defaultLanguage =
      venueFields.defaultLanguage ?? current.defaultLanguage;
    if (!languages.includes(defaultLanguage)) {
      return NextResponse.json(
        {
          error: `Default language "${defaultLanguage}" must be one of the venue's languages`,
        },
        { status: 400 },
      );
    }
  }

  return guarded(async () => {
    await prisma.$transaction(async (tx) => {
      if (Object.keys(venueFields).length > 0) {
        await tx.heritageVenue.update({
          where: { id: venueId },
          // `defaultRights` is typed as a plain string by the partial schema;
          // Prisma narrows it against the enum at the client boundary.
          data: venueFields as never,
        });
      }
      if (isPublished !== undefined) {
        await tx.project.update({
          where: { id: access.venue.projectId },
          data: { isPublished },
        });
      }
    });
    return NextResponse.json({ ok: true });
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { venueId } = await params;
  const access = await requireVenueAccess(venueId, "manage");
  if (access.denied) return access.denied;

  return guarded(async () => {
    // Deleting the Project cascades to HeritageVenue and, through it, to
    // every space, scene, object, representation, proxy and tour below it.
    await prisma.project.delete({ where: { id: access.venue.projectId } });
    return NextResponse.json({ ok: true });
  });
}
