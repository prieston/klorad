/**
 * GET / PATCH / DELETE a single Representation, including its paradata.
 *
 * Paradata is upserted through this route rather than a separate one because
 * it is 1:1 with the representation and §7.2.4 warns it is the requirement
 * most likely to be cut under schedule pressure. Keeping it on the same
 * endpoint as the thing it describes makes it harder to skip.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireVenueAccess } from "@/lib/authz";
import {
  guarded,
  localized,
  notFound,
  readJson,
  serialiseBigInts,
} from "@/lib/heritage/crud";
import { assertVenueScoped } from "@/lib/heritage/scope";
import { ALL_RIGHTS } from "@/lib/heritage/rights";

type Params = Promise<{ venueId: string; representationId: string }>;

const STATES = ["draft", "in_review", "approved", "published", "archived"] as const;
const STATUSES = [
  "pending",
  "uploading",
  "queued",
  "processing",
  "ready",
  "failed",
] as const;
const METHODS = [
  "photogrammetry",
  "laser_scan",
  "structured_light",
  "gaussian_splat",
  "manual_model",
  "photography",
  "born_digital",
  "unknown",
] as const;

export async function GET(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { venueId, representationId } = await params;
  const access = await requireVenueAccess(venueId, "read");
  if (access.denied) return access.denied;

  const representation = await prisma.heritageRepresentation.findFirst({
    where: { id: representationId, venueId },
    include: {
      files: true,
      paradata: { include: { operatorActor: true } },
      object: { select: { id: true, slug: true, title: true, rights: true } },
      space: { select: { id: true, slug: true, name: true } },
      layers: { select: { id: true, sceneId: true, role: true } },
    },
  });
  if (!representation) return notFound();
  return NextResponse.json(serialiseBigInts({ representation }));
}

const ParadataBody = z.object({
  method: z.enum(METHODS).optional(),
  deviceName: z.string().max(200).nullable().optional(),
  processingChain: z.array(z.record(z.string(), z.unknown())).nullable().optional(),
  capturedAt: z.string().datetime().nullable().optional(),
  processedAt: z.string().datetime().nullable().optional(),
  operatorActorId: z.string().nullable().optional(),
  vigieComplexity: z.string().max(80).nullable().optional(),
  intendedPurpose: z.string().max(400).nullable().optional(),
  accuracyMeters: z.number().positive().nullable().optional(),
  notes: localized.nullable().optional(),
});

const PatchBody = z
  .object({
    label: localized.nullable(),
    status: z.enum(STATUSES),
    state: z.enum(STATES),
    objectId: z.string().nullable(),
    spaceId: z.string().nullable(),
    splatCount: z.number().int().nonnegative().nullable(),
    triangleCount: z.number().int().nonnegative().nullable(),
    boundingBox: z.record(z.string(), z.unknown()).nullable(),
    durationSec: z.number().nonnegative().nullable(),
    rights: z.enum(ALL_RIGHTS as [string, ...string[]]).nullable(),
    rightsHolder: z.string().max(200).nullable(),
    rightsNote: z.string().max(2000).nullable(),
    failureReason: z.string().max(2000).nullable(),
    paradata: ParadataBody,
  })
  .partial();

export async function PATCH(
  req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { venueId, representationId } = await params;
  const access = await requireVenueAccess(venueId, "write");
  if (access.denied) return access.denied;

  const parsed = await readJson(req, PatchBody);
  if ("error" in parsed) return parsed.error;
  const { paradata, ...fields } = parsed.data;

  const scopeError = await assertVenueScoped(venueId, {
    objectId: fields.objectId,
    spaceId: fields.spaceId,
    actorId: paradata?.operatorActorId,
  });
  if (scopeError) return scopeError;

  return guarded(async () => {
    const exists = await prisma.heritageRepresentation.findFirst({
      where: { id: representationId, venueId },
      select: { id: true },
    });
    if (!exists) return notFound();

    await prisma.$transaction(async (tx) => {
      if (Object.keys(fields).length > 0) {
        await tx.heritageRepresentation.update({
          where: { id: representationId },
          data: fields as never,
        });
      }
      if (paradata) {
        const data = {
          ...paradata,
          capturedAt: paradata.capturedAt ? new Date(paradata.capturedAt) : paradata.capturedAt,
          processedAt: paradata.processedAt ? new Date(paradata.processedAt) : paradata.processedAt,
        };
        await tx.heritageParadata.upsert({
          where: { representationId },
          create: { representationId, ...data } as never,
          update: data as never,
        });
      }
    });
    return NextResponse.json({ ok: true });
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { venueId, representationId } = await params;
  const access = await requireVenueAccess(venueId, "manage");
  if (access.denied) return access.denied;

  return guarded(async () => {
    const { count } = await prisma.heritageRepresentation.deleteMany({
      where: { id: representationId, venueId },
    });
    if (count === 0) return notFound();
    return NextResponse.json({ ok: true });
  });
}
