/**
 * GET    /api/venues/[venueId]/uploads/[sessionId] — resume state.
 * DELETE /api/venues/[venueId]/uploads/[sessionId] — abort and reclaim parts.
 *
 * The GET is what makes an upload resumable across a browser restart: it
 * reports which part numbers the server has already accepted, so the client
 * re-slices the same file and skips them.
 */
import { NextResponse } from "next/server";
import { abortMultipartUpload, storageConfigFromEnv } from "@klorad/storage/server";
import { prisma } from "@/lib/prisma";
import { requireVenueAccess } from "@/lib/authz";
import { guarded, notFound, serialiseBigInts } from "@/lib/heritage/crud";

type Params = Promise<{ venueId: string; sessionId: string }>;

export async function GET(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { venueId, sessionId } = await params;
  const access = await requireVenueAccess(venueId, "read");
  if (access.denied) return access.denied;

  const session = await prisma.heritageUploadSession.findFirst({
    where: { id: sessionId, venueId },
    include: {
      parts: { select: { partNumber: true }, orderBy: { partNumber: "asc" } },
    },
  });
  if (!session) return notFound();

  const uploadedParts = session.parts.map((p) => p.partNumber);
  return NextResponse.json(
    serialiseBigInts({
      session: {
        id: session.id,
        fileName: session.fileName,
        fileType: session.fileType,
        sizeBytes: session.sizeBytes,
        partSize: session.partSize,
        partCount: session.partCount,
        purpose: session.purpose,
        status: session.status,
        failureReason: session.failureReason,
        expiresAt: session.expiresAt.toISOString(),
        representationId: session.representationId,
      },
      uploadedParts,
      /** What the client still has to push. */
      remainingParts: Array.from(
        { length: session.partCount },
        (_, i) => i + 1,
      ).filter((n) => !uploadedParts.includes(n)),
    }),
  );
}

export async function DELETE(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { venueId, sessionId } = await params;
  const access = await requireVenueAccess(venueId, "write");
  if (access.denied) return access.denied;

  const session = await prisma.heritageUploadSession.findFirst({
    where: { id: sessionId, venueId },
    select: { id: true, storageKey: true, uploadId: true, status: true },
  });
  if (!session) return notFound();

  return guarded(async () => {
    if (session.status === "pending" || session.status === "in_progress") {
      // Abort at the provider first. If this throws we leave the row
      // in place rather than marking it aborted — a row that says
      // "aborted" while the provider still bills for the parts is worse
      // than one that can be retried.
      await abortMultipartUpload(storageConfigFromEnv(), {
        key: session.storageKey,
        uploadId: session.uploadId,
      });
    }
    await prisma.heritageUploadSession.update({
      where: { id: session.id },
      data: { status: "aborted", failureReason: "Cancelled by the curator" },
    });
    return NextResponse.json({ ok: true });
  });
}
