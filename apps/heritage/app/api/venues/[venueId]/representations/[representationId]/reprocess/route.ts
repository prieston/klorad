/**
 * POST /api/venues/[venueId]/representations/[representationId]/reprocess
 *
 * Run the pipeline again over an already-uploaded file.
 *
 * Worth having as a first-class action rather than telling a curator to
 * re-upload: the bytes are already stored, and asking someone to push 26 GB a
 * second time because a storage read timed out is not a recovery story. It
 * also covers the case where a format gains a pipeline after the fact — the
 * archival masters sitting in the bucket become deliverable without anyone
 * touching the originals.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireVenueAccess } from "@/lib/authz";
import { badRequest, guarded, notFound } from "@/lib/heritage/crud";
import { JOB_KIND_FOR, estimateProcessingSeconds } from "@/lib/heritage/ingest";
import { runIngestJob } from "@/lib/heritage/pipeline/run";

type Params = Promise<{ venueId: string; representationId: string }>;

export async function POST(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { venueId, representationId } = await params;
  const access = await requireVenueAccess(venueId, "write");
  if (access.denied) return access.denied;

  const representation = await prisma.heritageRepresentation.findFirst({
    where: { id: representationId, venueId },
    include: { files: { orderBy: { createdAt: "desc" } } },
  });
  if (!representation) return notFound();

  const source =
    representation.files.find((f) => f.purpose === "master") ?? representation.files[0];
  if (!source) {
    return badRequest(
      "There is no uploaded file on this representation, so there is nothing to reprocess.",
    );
  }

  return guarded(async () => {
    const job = await prisma.heritageIngestJob.create({
      data: {
        venueId,
        representationId,
        kind: JOB_KIND_FOR[representation.kind],
        status: "queued",
        estimatedSeconds: estimateProcessingSeconds(
          representation.kind,
          Number(source.sizeBytes ?? 0),
        ),
        parameters: {
          sourceFormat: source.format,
          sourceBytes: source.sizeBytes?.toString() ?? null,
          sourceKey: source.storageKey,
          purpose: source.purpose,
          reprocess: true,
        },
      },
      select: { id: true },
    });

    // A fresh job row rather than resetting the old one: §7.2.2 wants the
    // parameters an output was produced with, and overwriting the previous
    // attempt would erase the record of what was tried and why it failed.
    const outcome = await runIngestJob(job.id);

    return NextResponse.json({
      jobId: job.id,
      status: outcome.status,
      deliverable: outcome.deliverable,
      note: outcome.detail,
    });
  });
}
