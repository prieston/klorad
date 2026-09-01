/**
 * POST /api/venues/[venueId]/uploads — begin a resumable upload.
 * GET  /api/venues/[venueId]/uploads — list this venue's live sessions.
 *
 * Returns the part plan the browser slices against. Nothing is written to the
 * Representation yet: the file is bytes until the upload completes, and a
 * half-uploaded 26 GB master must not look like a capture the venue holds.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createMultipartUpload,
  recommendPartSize,
  storageConfigFromEnv,
} from "@klorad/storage/server";
import { prisma } from "@/lib/prisma";
import { requireVenueAccess } from "@/lib/authz";
import { features } from "@/lib/env";
import { badRequest, guarded, readJson, serialiseBigInts } from "@/lib/heritage/crud";
import { assertVenueScoped } from "@/lib/heritage/scope";
import {
  MAX_UPLOAD_BYTES,
  UPLOAD_SESSION_TTL_MS,
  archivalOnlyReason,
  isAcceptedFor,
  rejectionReason,
  storagePrefixFor,
} from "@/lib/heritage/ingest";

type Params = Promise<{ venueId: string }>;

const KINDS = [
  "mesh",
  "splat",
  "point_cloud",
  "image",
  "audio",
  "video",
  "panorama",
] as const;

const PURPOSES = [
  "master",
  "delivery",
  "tileset",
  "lod",
  "thumbnail",
  "transcript",
  "caption",
] as const;

export async function GET(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { venueId } = await params;
  const access = await requireVenueAccess(venueId, "read");
  if (access.denied) return access.denied;

  const sessions = await prisma.heritageUploadSession.findMany({
    where: { venueId, status: { in: ["pending", "in_progress"] } },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { parts: true } } },
  });
  return NextResponse.json(serialiseBigInts({ sessions }));
}

const StartBody = z.object({
  fileName: z.string().min(1).max(255),
  fileType: z.string().min(1).max(160),
  sizeBytes: z.number().int().positive(),
  /** Declared by the curator, not sniffed — `.ply` is both a splat master and
   *  a mesh interchange format, and guessing sends it down the wrong
   *  pipeline. */
  kind: z.enum(KINDS),
  purpose: z.enum(PURPOSES).default("master"),
  /** Attach to an existing representation, or leave null and bind on
   *  completion. */
  representationId: z.string().nullable().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { venueId } = await params;
  const access = await requireVenueAccess(venueId, "write");
  if (access.denied) return access.denied;

  if (!features.uploads) {
    return NextResponse.json(
      {
        error:
          "Object storage is not configured for this deployment. Set the DO_SPACES_* variables and restart.",
      },
      { status: 503 },
    );
  }

  const parsed = await readJson(req, StartBody);
  if ("error" in parsed) return parsed.error;
  const { fileName, fileType, sizeBytes, kind, purpose, representationId } =
    parsed.data;

  if (!isAcceptedFor(kind, fileName)) {
    return badRequest(rejectionReason(kind, fileName));
  }
  if (sizeBytes > MAX_UPLOAD_BYTES) {
    return badRequest(
      `That file is ${(sizeBytes / 1024 ** 3).toFixed(1)} GB, above the ${MAX_UPLOAD_BYTES / 1024 ** 3} GB per-file limit. Split the capture and upload it as separate representations.`,
    );
  }

  const scopeError = await assertVenueScoped(venueId, { representationId });
  if (scopeError) return scopeError;

  return guarded(async () => {
    const partSize = recommendPartSize(sizeBytes);
    const partCount = Math.ceil(sizeBytes / partSize);

    const created = await createMultipartUpload(storageConfigFromEnv(), {
      fileName,
      fileType,
      prefix: storagePrefixFor(venueId),
      // Private without exception. Rights decide how long a delivery URL
      // lives, not whether the object is world-readable — a public bucket URL
      // cannot be un-shared once someone has it, which is the whole reason the
      // rights console was previously making a promise it could not keep.
      acl: "private",
    });

    const session = await prisma.heritageUploadSession.create({
      data: {
        venueId,
        representationId: representationId ?? null,
        storageKey: created.key,
        uploadId: created.uploadId,
        fileName,
        fileType,
        sizeBytes: BigInt(sizeBytes),
        partSize,
        partCount,
        purpose,
        status: "pending",
        expiresAt: new Date(Date.now() + UPLOAD_SESSION_TTL_MS),
      },
      select: { id: true, partSize: true, partCount: true, expiresAt: true },
    });

    return NextResponse.json(
      {
        sessionId: session.id,
        partSize: session.partSize,
        partCount: session.partCount,
        expiresAt: session.expiresAt.toISOString(),
        /** Empty on a fresh session; a resumed one reports what it already
         *  has via GET on the session. */
        uploadedParts: [],
        /** Set when the file will be kept but cannot be shown to visitors as
         *  it stands. Returned *before* a byte moves so a curator can cancel
         *  and re-export rather than discovering it after pushing 26 GB —
         *  which is the same reason format rejection happens up here too. */
        archivalNotice: archivalOnlyReason(kind, fileName),
      },
      { status: 201 },
    );
  });
}
