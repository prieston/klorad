import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireVenueAccess } from "@/lib/authz";
import { features } from "@/lib/env";
import { pickLocalized } from "@/lib/heritage/i18n";
import { IngestClient } from "./IngestClient";

type Params = Promise<{ orgId: string; venueId: string }>;

export const metadata = { title: "Ingest" };

/**
 * HER-201 / HER-202 — asset ingest and the processing queue.
 *
 * Shows what has been uploaded, what is queued, and why anything failed. The
 * transcoding worker is separate infrastructure and is not deployed, so jobs
 * rest at `queued` and the page says so rather than spinning.
 */
export default async function RepresentationsPage({
  params,
}: {
  params: Params;
}) {
  const { venueId } = await params;
  const access = await requireVenueAccess(venueId, "read");
  if (access.denied) notFound();

  const [venue, representations, jobs, liveSessions] = await Promise.all([
    prisma.heritageVenue.findUnique({
      where: { id: venueId },
      select: { defaultLanguage: true },
    }),
    prisma.heritageRepresentation.findMany({
      where: { venueId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        files: { orderBy: { createdAt: "asc" } },
        object: { select: { id: true, title: true } },
        space: { select: { id: true, name: true } },
      },
    }),
    prisma.heritageIngestJob.findMany({
      where: { venueId, status: { in: ["queued", "claimed", "running", "failed"] } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.heritageUploadSession.findMany({
      where: { venueId, status: { in: ["pending", "in_progress"] } },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { parts: true } } },
    }),
  ]);
  if (!venue) notFound();

  const lang = venue.defaultLanguage;
  const jobByRep = new Map(jobs.map((j) => [j.representationId, j]));

  return (
    <IngestClient
      venueId={venueId}
      storageConfigured={features.uploads}
      initialRepresentations={representations.map((r) => ({
        id: r.id,
        kind: r.kind,
        status: r.status,
        state: r.state,
        label: pickLocalized(r.label, lang, "en"),
        attachedTo:
          pickLocalized(r.object?.title, lang, "en") ??
          pickLocalized(r.space?.name, lang, "en") ??
          null,
        failureReason: r.failureReason,
        createdAt: r.createdAt.toISOString(),
        files: r.files.map((f) => ({
          id: f.id,
          purpose: f.purpose,
          format: f.format,
          sizeBytes: f.sizeBytes ? f.sizeBytes.toString() : null,
          url: f.url,
        })),
        job: (() => {
          const j = jobByRep.get(r.id);
          return j
            ? {
                id: j.id,
                kind: j.kind,
                status: j.status,
                attempts: j.attempts,
                estimatedSeconds: j.estimatedSeconds,
                failureReason: j.failureReason,
              }
            : null;
        })(),
      }))}
      initialSessions={liveSessions.map((s) => ({
        id: s.id,
        fileName: s.fileName,
        sizeBytes: s.sizeBytes.toString(),
        partCount: s.partCount,
        uploadedParts: s._count.parts,
        status: s.status,
        expiresAt: s.expiresAt.toISOString(),
      }))}
    />
  );
}
