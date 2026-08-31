/**
 * GET / PATCH / DELETE a single Proxy.
 *
 * PATCH can clear `invalidatedAt` — that is the curator saying "I have
 * re-checked this proxy against the new capture". It is a deliberate,
 * explicit act, which is why re-authoring the transform alone does not clear
 * it: moving a box is not the same as confirming it is on the right thing.
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
  transformSchema,
} from "@/lib/heritage/crud";
import { assertVenueScoped } from "@/lib/heritage/scope";

type Params = Promise<{ venueId: string; proxyId: string }>;

const SHAPES = ["box", "sphere", "cylinder", "plane", "mesh"] as const;
const INTERACTIONS = [
  "none",
  "info",
  "tour_stop",
  "external_link",
  "scene_link",
] as const;
const STATES = ["draft", "in_review", "approved", "published", "archived"] as const;

export async function GET(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { venueId, proxyId } = await params;
  const access = await requireVenueAccess(venueId, "read");
  if (access.denied) return access.denied;

  const proxy = await prisma.heritageProxy.findFirst({
    where: { id: proxyId, venueId },
    include: {
      object: { select: { id: true, slug: true, title: true } },
      scene: { select: { id: true, slug: true, title: true, lastRecapturedAt: true } },
    },
  });
  if (!proxy) return notFound();
  return NextResponse.json({ proxy });
}

const PatchBody = z
  .object({
    objectId: z.string().nullable(),
    shape: z.enum(SHAPES),
    interaction: z.enum(INTERACTIONS),
    transform: transformSchema,
    geometryUrl: z.string().url().nullable(),
    label: localized.nullable(),
    href: z.string().max(2000).nullable(),
    sortOrder: z.number().int(),
    state: z.enum(STATES),
    /** Only `true` is meaningful: confirm this proxy still lands on the right
     *  geometry after a recapture. Marking one stale is the pipeline's job. */
    revalidate: z.literal(true),
  })
  .partial();

export async function PATCH(
  req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { venueId, proxyId } = await params;
  const access = await requireVenueAccess(venueId, "write");
  if (access.denied) return access.denied;

  const parsed = await readJson(req, PatchBody);
  if ("error" in parsed) return parsed.error;
  const { revalidate, ...fields } = parsed.data;

  const scopeError = await assertVenueScoped(venueId, {
    objectId: fields.objectId,
  });
  if (scopeError) return scopeError;

  return guarded(async () => {
    const { count } = await prisma.heritageProxy.updateMany({
      where: { id: proxyId, venueId },
      data: {
        ...fields,
        ...(revalidate
          ? { invalidatedAt: null, invalidatedReason: null }
          : {}),
      } as never,
    });
    if (count === 0) return notFound();
    return NextResponse.json({ ok: true });
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { venueId, proxyId } = await params;
  const access = await requireVenueAccess(venueId, "write");
  if (access.denied) return access.denied;

  return guarded(async () => {
    const { count } = await prisma.heritageProxy.deleteMany({
      where: { id: proxyId, venueId },
    });
    if (count === 0) return notFound();
    return NextResponse.json({ ok: true });
  });
}
