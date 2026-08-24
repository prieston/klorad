/**
 * GET / PATCH / DELETE a single Scene.
 *
 * `lastRecapturedAt` is not editable here. Modelling rule 4 makes a recapture
 * a consequential event — it invalidates every proxy authored against the old
 * geometry — so it is set by the ingest pipeline when a base layer is
 * replaced, and the same operation marks the proxies. Letting a PATCH move
 * that timestamp would let the invalidation be silently undone.
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
  slugSchema,
} from "@/lib/heritage/crud";
import { assertVenueScoped } from "@/lib/heritage/scope";

type Params = Promise<{ venueId: string; sceneId: string }>;

const KINDS = ["mesh", "splat", "composite", "panorama"] as const;
const STATES = ["draft", "in_review", "approved", "published", "archived"] as const;
const STATUSES = [
  "pending",
  "uploading",
  "queued",
  "processing",
  "ready",
  "failed",
] as const;

export async function GET(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { venueId, sceneId } = await params;
  const access = await requireVenueAccess(venueId, "read");
  if (access.denied) return access.denied;

  const scene = await prisma.heritageScene.findFirst({
    where: { id: sceneId, venueId },
    include: {
      space: { select: { id: true, slug: true, name: true } },
      layers: {
        orderBy: { sortOrder: "asc" },
        include: {
          representation: { include: { files: true } },
        },
      },
      proxies: {
        orderBy: { sortOrder: "asc" },
        include: { object: { select: { id: true, slug: true, title: true } } },
      },
    },
  });
  if (!scene) return notFound();

  // Modelling rule 4 made visible: how many proxies in this scene were
  // authored against geometry that has since been replaced. The console shows
  // this rather than making a curator notice it themselves.
  const staleProxyCount = scene.proxies.filter((p) => p.invalidatedAt).length;

  return NextResponse.json(serialiseBigInts({ scene, staleProxyCount }));
}

const PatchBody = z
  .object({
    slug: slugSchema,
    title: localized,
    description: localized.nullable(),
    kind: z.enum(KINDS),
    spaceId: z.string().nullable(),
    status: z.enum(STATUSES),
    state: z.enum(STATES),
    tilesetUrl: z.string().url().nullable(),
    initialCamera: z.record(z.string(), z.unknown()).nullable(),
    environment: z.record(z.string(), z.unknown()).nullable(),
    floorProxyUrl: z.string().url().nullable(),
    splatBudget: z.number().int().positive().nullable(),
    triangleCount: z.number().int().nonnegative().nullable(),
  })
  .partial();

export async function PATCH(
  req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { venueId, sceneId } = await params;
  const access = await requireVenueAccess(venueId, "write");
  if (access.denied) return access.denied;

  const parsed = await readJson(req, PatchBody);
  if ("error" in parsed) return parsed.error;

  const scopeError = await assertVenueScoped(venueId, parsed.data);
  if (scopeError) return scopeError;

  return guarded(async () => {
    const { count } = await prisma.heritageScene.updateMany({
      where: { id: sceneId, venueId },
      data: parsed.data as never,
    });
    if (count === 0) return notFound();
    return NextResponse.json({ ok: true });
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { venueId, sceneId } = await params;
  const access = await requireVenueAccess(venueId, "manage");
  if (access.denied) return access.denied;

  return guarded(async () => {
    const { count } = await prisma.heritageScene.deleteMany({
      where: { id: sceneId, venueId },
    });
    if (count === 0) return notFound();
    return NextResponse.json({ ok: true });
  });
}
