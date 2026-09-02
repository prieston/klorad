import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireVenueAccess } from "@/lib/authz";
import { pickLocalized } from "@/lib/heritage/i18n";
import { ObjectsClient } from "./ObjectsClient";

type Params = Promise<{ orgId: string; venueId: string }>;

export const metadata = { title: "Items" };

/**
 * HER-205 — object records.
 *
 * "A form, not an ontology editor." The curator sees fields; CIDOC-CRM and
 * Linked Art are what the system writes underneath. Rights recorded here are
 * the *original's* — each capture carries its own, and a read resolves to the
 * more restrictive of the two.
 */
export default async function ObjectsPage({ params }: { params: Params }) {
  const { orgId, venueId } = await params;
  const access = await requireVenueAccess(venueId, "read");
  if (access.denied) notFound();

  const venue = await prisma.heritageVenue.findUnique({
    where: { id: venueId },
    select: { languages: true, defaultLanguage: true, defaultRights: true },
  });
  if (!venue) notFound();

  const [objects, spaces, periods] = await Promise.all([
    prisma.heritageObject.findMany({
      where: { venueId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: {
        _count: { select: { representations: true, proxies: true } },
      },
    }),
    prisma.heritageSpace.findMany({
      where: { venueId },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, slug: true },
    }),
    prisma.heritagePeriod.findMany({
      where: { venueId },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const lang = venue.defaultLanguage;

  return (
    <ObjectsClient
      venueId={venueId}
      orgId={orgId}
      languages={venue.languages}
      defaultLanguage={lang}
      spaces={spaces.map((s) => ({
        id: s.id,
        label: pickLocalized(s.name, lang, "en") ?? s.slug,
      }))}
      periods={periods.map((p) => ({
        id: p.id,
        label: pickLocalized(p.name, lang, "en") ?? "Untitled period",
      }))}
      initial={objects.map((o) => ({
        id: o.id,
        slug: o.slug,
        identifier: o.identifier,
        title: (o.title ?? {}) as Record<string, string>,
        description: (o.description ?? {}) as Record<string, string>,
        creditLine: (o.creditLine ?? {}) as Record<string, string>,
        objectType: o.objectType,
        materials: o.materials,
        spaceId: o.spaceId,
        periodId: o.periodId,
        rights: o.rights,
        rightsHolder: o.rightsHolder,
        externalUri: o.externalUri,
        sortOrder: o.sortOrder,
        state: o.state,
        representationCount: o._count.representations,
        proxyCount: o._count.proxies,
      }))}
    />
  );
}
