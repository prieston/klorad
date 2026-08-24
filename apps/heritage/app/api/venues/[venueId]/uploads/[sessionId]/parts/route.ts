/**
 * POST /api/venues/[venueId]/uploads/[sessionId]/parts — presign one part.
 * PUT  /api/venues/[venueId]/uploads/[sessionId]/parts — record one uploaded part.
 *
 * Split into two calls because the part travels straight from the browser to
 * object storage and never through this server. The POST hands out a signed
 * URL; the PUT records the ETag the provider gave back, which is the only way
 * the completion call can assemble the object.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { presignUploadPart, storageConfigFromEnv } from "@klorad/storage/server";
import { prisma } from "@/lib/prisma";
import { requireVenueAccess } from "@/lib/authz";
import { badRequest, guarded, notFound, readJson } from "@/lib/heritage/crud";

type Params = Promise<{ venueId: string; sessionId: string }>;

async function liveSession(venueId: string, sessionId: string) {
  return prisma.heritageUploadSession.findFirst({
    where: { id: sessionId, venueId },
    select: {
      id: true,
      storageKey: true,
      uploadId: true,
      partCount: true,
      status: true,
      expiresAt: true,
    },
  });
}

const PresignBody = z.object({ partNumber: z.number().int().min(1) });

export async function POST(
  req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { venueId, sessionId } = await params;
  const access = await requireVenueAccess(venueId, "write");
  if (access.denied) return access.denied;

  const parsed = await readJson(req, PresignBody);
  if ("error" in parsed) return parsed.error;

  const session = await liveSession(venueId, sessionId);
  if (!session) return notFound();
  if (session.status !== "pending" && session.status !== "in_progress") {
    return badRequest(`This upload is ${session.status} and cannot take more parts`);
  }
  if (session.expiresAt.getTime() < Date.now()) {
    return badRequest("This upload session has expired — start a new one");
  }
  if (parsed.data.partNumber > session.partCount) {
    return badRequest(
      `Part ${parsed.data.partNumber} is beyond this upload's ${session.partCount} parts`,
    );
  }

  return guarded(async () => {
    const url = await presignUploadPart(storageConfigFromEnv(), {
      key: session.storageKey,
      uploadId: session.uploadId,
      partNumber: parsed.data.partNumber,
    });
    return NextResponse.json({ url });
  });
}

const RecordBody = z.object({
  partNumber: z.number().int().min(1),
  /** Providers quote the ETag; the browser passes it through verbatim. */
  eTag: z.string().min(1).max(200),
  sizeBytes: z.number().int().positive(),
});

export async function PUT(
  req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { venueId, sessionId } = await params;
  const access = await requireVenueAccess(venueId, "write");
  if (access.denied) return access.denied;

  const parsed = await readJson(req, RecordBody);
  if ("error" in parsed) return parsed.error;
  const { partNumber, eTag, sizeBytes } = parsed.data;

  const session = await liveSession(venueId, sessionId);
  if (!session) return notFound();
  if (partNumber > session.partCount) {
    return badRequest(
      `Part ${partNumber} is beyond this upload's ${session.partCount} parts`,
    );
  }

  return guarded(async () => {
    // Upsert rather than create: a part that timed out client-side may have
    // succeeded at the provider and be retried, and the retry must not 409.
    await prisma.heritageUploadPart.upsert({
      where: { sessionId_partNumber: { sessionId: session.id, partNumber } },
      create: { sessionId: session.id, partNumber, eTag, sizeBytes },
      update: { eTag, sizeBytes },
    });

    const done = await prisma.heritageUploadPart.count({
      where: { sessionId: session.id },
    });
    if (session.status === "pending") {
      await prisma.heritageUploadSession.update({
        where: { id: session.id },
        data: { status: "in_progress" },
      });
    }

    return NextResponse.json({
      ok: true,
      uploadedParts: done,
      partCount: session.partCount,
      complete: done >= session.partCount,
    });
  });
}
