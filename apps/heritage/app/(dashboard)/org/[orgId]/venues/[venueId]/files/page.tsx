import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireVenueAccess } from "@/lib/authz";
import { features } from "@/lib/env";
import { pickLocalized } from "@/lib/heritage/i18n";
import { IngestClient } from "./IngestClient";

type Params = Promise<{ orgId: string; venueId: string }>;

export const metadata = { title: "Files" };

/**
 * HER-201 / HER-202 — asset ingest and the processing queue.
 *
 * Shows what has been uploaded, what is deliverable, and why anything failed.
 *
 * Uploads are processed inline at completion, so by the time this page renders
 * a just-finished upload it is normally already `ready`. A row resting at
 * `queued` means the inline run was cut short and the drain endpoint has not
 * caught up yet — a real state, not a permanent one.
 */
export default async function RepresentationsPage({
  params,
}: {
  params: Params;
}) {
  const { venueId } = await params;
  const access = await requireVenueAccess(venueId, "read");
  if (access.denied) notFound();

  const [venue, representations, jobs, liveSessions, objects, spaces] =
    await Promise.all([
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
        object: { select: { id: true, title: true, rights: true } },
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
    // The pickers for attaching a capture to what it depicts. Loaded here
    // rather than fetched on demand: a curator who has just uploaded is about
    // to attach, and a spinner between those two moments is friction on the
    // single most common next action.
    prisma.heritageObject.findMany({
      where: { venueId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, title: true, identifier: true },
    }),
    prisma.heritageSpace.findMany({
      where: { venueId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true },
    }),
  ]);
  if (!venue) notFound();

  const lang = venue.defaultLanguage;
  const jobByRep = new Map(jobs.map((j) => [j.representationId, j]));

  return (
    <IngestClient
      venueId={venueId}
      storageConfigured={features.uploads}
      objects={objects.map((o) => ({
        id: o.id,
        label:
          [pickLocalized(o.title, lang, "en"), o.identifier]
            .filter(Boolean)
            .join(" · ") || "Untitled object",
      }))}
      spaces={spaces.map((sp) => ({
        id: sp.id,
        label: pickLocalized(sp.name, lang, "en") ?? "Untitled space",
      }))}
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
        objectId: r.object?.id ?? null,
        spaceId: r.space?.id ?? null,
        rights: r.rights,
        /** The depicted object's statement, shown so a curator can see what
         *  this capture would resolve to if left unset — the answer is rarely
         *  what they assume. */
        objectRights: r.object?.rights ?? null,
        /** Whether a visitor can see this, as opposed to it being stored.
         *  Derived from the presence of a delivery file rather than from
         *  `status`, because a successfully-processed archival master is
         *  legitimately `ready` and still not viewable. */
        deliverable: r.files.some((f) => f.purpose === "delivery" && f.url),
        triangleCount: r.triangleCount,
        widthPx: r.widthPx,
        heightPx: r.heightPx,
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
