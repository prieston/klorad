import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireVenueAccess } from "@/lib/authz";
import { pickLocalized } from "@/lib/heritage/i18n";
import { ParadataClient } from "./ParadataClient";

type Params = Promise<{ orgId: string; venueId: string }>;

export const metadata = { title: "Paradata" };

/**
 * HER-204 — paradata.
 *
 * How each capture was made: device, method, processing chain, date, operator,
 * and the purpose it was made for. Attached to the Representation and never to
 * the object, because one sculpture may carry a 2009 laser scan and a 2026
 * splat capture with entirely different trustworthiness.
 *
 * §13.3 lists this as the requirement most likely to be cut under schedule
 * pressure and says it should not be. It is also the argument that makes the
 * platform credible to a curator and impossible for a capture-only vendor to
 * answer, so it ships with the record rather than after it.
 */
export default async function ParadataPage({ params }: { params: Params }) {
  const { venueId } = await params;
  const access = await requireVenueAccess(venueId, "read");
  if (access.denied) notFound();

  const venue = await prisma.heritageVenue.findUnique({
    where: { id: venueId },
    select: { defaultLanguage: true },
  });
  if (!venue) notFound();

  const [representations, actors] = await Promise.all([
    prisma.heritageRepresentation.findMany({
      where: { venueId },
      orderBy: { createdAt: "desc" },
      include: {
        paradata: true,
        object: { select: { title: true } },
        space: { select: { name: true } },
        files: { select: { format: true, purpose: true }, take: 1 },
      },
    }),
    prisma.heritageActor.findMany({
      where: { venueId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const lang = venue.defaultLanguage;

  return (
    <ParadataClient
      venueId={venueId}
      actors={actors.map((a) => ({
        id: a.id,
        label: pickLocalized(a.name, lang, "en") ?? "Unnamed actor",
      }))}
      initial={representations.map((r) => ({
        id: r.id,
        kind: r.kind,
        label:
          pickLocalized(r.label, lang, "en") ??
          pickLocalized(r.object?.title, lang, "en") ??
          pickLocalized(r.space?.name, lang, "en") ??
          `${r.kind} capture`,
        format: r.files[0]?.format ?? null,
        paradata: r.paradata
          ? {
              method: r.paradata.method,
              deviceName: r.paradata.deviceName,
              capturedAt: r.paradata.capturedAt?.toISOString().slice(0, 10) ?? null,
              operatorActorId: r.paradata.operatorActorId,
              vigieComplexity: r.paradata.vigieComplexity,
              intendedPurpose: r.paradata.intendedPurpose,
              accuracyMeters: r.paradata.accuracyMeters,
              processingChain: (r.paradata.processingChain ?? []) as unknown[],
            }
          : null,
      }))}
    />
  );
}
