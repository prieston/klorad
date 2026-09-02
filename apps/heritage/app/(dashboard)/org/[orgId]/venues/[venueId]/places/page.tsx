import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireVenueAccess } from "@/lib/authz";
import { SpacesClient } from "./SpacesClient";

type Params = Promise<{ orgId: string; venueId: string }>;

export const metadata = { title: "Places" };

/**
 * Spaces — galleries, sectors, rooms and scanned scenes within a venue
 * (§8, CIDOC-CRM E53). Built before Objects and Scenes because both reference
 * a space, and a curator who has to invent one mid-form loses their place.
 */
export default async function SpacesPage({ params }: { params: Params }) {
  const { venueId } = await params;
  const access = await requireVenueAccess(venueId, "read");
  if (access.denied) notFound();

  const venue = await prisma.heritageVenue.findUnique({
    where: { id: venueId },
    select: { languages: true, defaultLanguage: true },
  });
  if (!venue) notFound();

  const spaces = await prisma.heritageSpace.findMany({
    where: { venueId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { scenes: true, objects: true } } },
  });

  return (
    <SpacesClient
      venueId={venueId}
      languages={venue.languages}
      defaultLanguage={venue.defaultLanguage}
      initial={spaces.map((s) => ({
        id: s.id,
        slug: s.slug,
        kind: s.kind,
        name: (s.name ?? {}) as Record<string, string>,
        description: (s.description ?? {}) as Record<string, string>,
        floor: s.floor,
        sortOrder: s.sortOrder,
        state: s.state,
        sceneCount: s._count.scenes,
        objectCount: s._count.objects,
      }))}
    />
  );
}
