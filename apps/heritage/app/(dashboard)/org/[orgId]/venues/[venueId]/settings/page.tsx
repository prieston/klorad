import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireVenueAccess } from "@/lib/authz";
import { SettingsClient } from "./SettingsClient";

type Params = Promise<{ orgId: string; venueId: string }>;

export const metadata = { title: "Venue settings" };

/**
 * Venue settings. Real, not a stub — the scaffold needs one working write
 * surface, and these are the settings everything else depends on: the
 * language set every content field is keyed by, the public URL the QR codes
 * and embeds point at, and the public-domain-scan rights policy that decides
 * how rights resolve across the whole venue.
 */
export default async function VenueSettingsPage({
  params,
}: {
  params: Params;
}) {
  const { venueId } = await params;
  const access = await requireVenueAccess(venueId, "read");
  if (access.denied) notFound();

  const venue = await prisma.heritageVenue.findUnique({
    where: { id: venueId },
    include: { project: { select: { isPublished: true } } },
  });
  if (!venue) notFound();

  return (
    <SettingsClient
      venueId={venue.id}
      initial={{
        slug: venue.slug,
        kind: venue.kind,
        name: (venue.name ?? {}) as Record<string, string>,
        summary: (venue.summary ?? {}) as Record<string, string>,
        languages: venue.languages,
        defaultLanguage: venue.defaultLanguage,
        scanOfPublicDomainAssertsRights: venue.scanOfPublicDomainAssertsRights,
        defaultRights: venue.defaultRights,
        isPublished: venue.project.isPublished,
      }}
    />
  );
}
