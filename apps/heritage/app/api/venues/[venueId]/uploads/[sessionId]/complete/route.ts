/**
 * POST /api/venues/[venueId]/uploads/[sessionId]/complete
 *
 * Assemble the parts, register the file against a Representation, and enqueue
 * the processing job.
 *
 * This is where bytes become a capture the venue holds. Order matters: the
 * storage provider assembles first, and only a successful assembly writes the
 * Representation — otherwise a failed completion leaves a record pointing at
 * an object that does not exist.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  completeMultipartUpload,
  storageConfigFromEnv,
} from "@klorad/storage/server";
import { prisma } from "@/lib/prisma";
import { requireVenueAccess } from "@/lib/authz";
import {
  badRequest,
  guarded,
  localized,
  notFound,
  readJson,
} from "@/lib/heritage/crud";
import { assertVenueScoped } from "@/lib/heritage/scope";
import {
  JOB_KIND_FOR,
  estimateProcessingSeconds,
  extensionOf,
} from "@/lib/heritage/ingest";

type Params = Promise<{ venueId: string; sessionId: string }>;

const KINDS = [
  "mesh",
  "splat",
  "point_cloud",
  "image",
  "audio",
  "video",
  "panorama",
] as const;

const CompleteBody = z.object({
  /** Required when the session was started without one — the upload becomes a
   *  Representation at this moment, and it needs to know what it depicts. */
  kind: z.enum(KINDS).optional(),
  label: localized.optional(),
  objectId: z.string().nullable().optional(),
  spaceId: z.string().nullable().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { venueId, sessionId } = await params;
  const access = await requireVenueAccess(venueId, "write");
  if (access.denied) return access.denied;

  const parsed = await readJson(req, CompleteBody);
  if ("error" in parsed) return parsed.error;

  const session = await prisma.heritageUploadSession.findFirst({
    where: { id: sessionId, venueId },
    include: { parts: { orderBy: { partNumber: "asc" } } },
  });
  if (!session) return notFound();
  if (session.status === "completed") {
    return badRequest("This upload has already been completed");
  }
  if (session.status !== "pending" && session.status !== "in_progress") {
    return badRequest(`This upload is ${session.status} and cannot be completed`);
  }
  if (session.parts.length !== session.partCount) {
    return badRequest(
      `Only ${session.parts.length} of ${session.partCount} parts have been uploaded`,
    );
  }

  const scopeError = await assertVenueScoped(venueId, {
    representationId: session.representationId,
    objectId: parsed.data.objectId,
    spaceId: parsed.data.spaceId,
  });
  if (scopeError) return scopeError;

  const kind = parsed.data.kind;
  if (!session.representationId && !kind) {
    return badRequest(
      "This upload is not attached to a representation, so `kind` is required to create one",
    );
  }

  return guarded(async () => {
    // 1. Assemble at the provider. Everything below assumes the object exists.
    const completed = await completeMultipartUpload(storageConfigFromEnv(), {
      key: session.storageKey,
      uploadId: session.uploadId,
      parts: session.parts.map((p) => ({
        partNumber: p.partNumber,
        eTag: p.eTag,
      })),
    });

    // 2. Record it, in one transaction so a representation never exists
    //    without its file or its queued job.
    const result = await prisma.$transaction(async (tx) => {
      const representationId =
        session.representationId ??
        (
          await tx.heritageRepresentation.create({
            data: {
              venueId,
              kind: kind!,
              label: parsed.data.label,
              objectId: parsed.data.objectId ?? null,
              spaceId: parsed.data.spaceId ?? null,
              status: "queued",
            },
            select: { id: true },
          })
        ).id;

      const representation = await tx.heritageRepresentation.update({
        where: { id: representationId },
        data: { status: "queued", failureReason: null },
        select: { id: true, kind: true },
      });

      await tx.heritageRepresentationFile.create({
        data: {
          representationId,
          purpose: session.purpose,
          storageKey: completed.key,
          url: completed.publicUrl,
          format: extensionOf(session.fileName),
          mimeType: session.fileType,
          sizeBytes: session.sizeBytes,
        },
      });

      const job = await tx.heritageIngestJob.create({
        data: {
          venueId,
          representationId,
          kind: JOB_KIND_FOR[representation.kind],
          status: "queued",
          estimatedSeconds: estimateProcessingSeconds(
            representation.kind,
            Number(session.sizeBytes),
          ),
          // §7.2.2: the parameters an output was produced with are recorded at
          // enqueue time, so paradata is partly automatic rather than
          // dependent on a curator remembering.
          parameters: {
            sourceFormat: extensionOf(session.fileName),
            sourceBytes: session.sizeBytes.toString(),
            sourceKey: completed.key,
            purpose: session.purpose,
          },
        },
        select: { id: true, estimatedSeconds: true },
      });

      await tx.heritageUploadSession.update({
        where: { id: session.id },
        data: { status: "completed", representationId },
      });

      return { representationId, jobId: job.id, estimatedSeconds: job.estimatedSeconds };
    });

    return NextResponse.json({
      representationId: result.representationId,
      jobId: result.jobId,
      estimatedSeconds: result.estimatedSeconds,
      url: completed.publicUrl,
      /** No worker is deployed yet, so the job will sit at `queued`. Said
       *  plainly rather than implied by a spinner that never resolves. */
      note: "Queued for processing. No processing worker is deployed yet, so this will remain queued.",
    });
  });
}
