/**
 * GET  /api/venues/[venueId]/proxies — list proxies, optionally per scene.
 * POST /api/venues/[venueId]/proxies — place one, or many at once.
 *
 * §5.3: a splat cloud contains no objects — no faces, no UVs, no node names —
 * and a raycast into it hits nothing. Proxies are the entire interaction layer
 * for a scanned site, and authoring them is manual labour proportional to how
 * tappable the client wants it. Bulk create exists because §7.2.3 calls for
 * snap, duplicate and bulk-place, and because a one-at-a-time API would make
 * the most-used tool in the console feel like data entry.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireVenueAccess } from "@/lib/authz";
import {
  guarded,
  localized,
  readJson,
  transformSchema,
} from "@/lib/heritage/crud";
import { assertVenueScoped } from "@/lib/heritage/scope";

type Params = Promise<{ venueId: string }>;

const SHAPES = ["box", "sphere", "cylinder", "plane", "mesh"] as const;
const INTERACTIONS = [
  "none",
  "info",
  "tour_stop",
  "external_link",
  "scene_link",
] as const;

export async function GET(
  req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { venueId } = await params;
  const access = await requireVenueAccess(venueId, "read");
  if (access.denied) return access.denied;

  const url = new URL(req.url);
  const sceneId = url.searchParams.get("sceneId");
  const staleOnly = url.searchParams.get("stale") === "1";

  const proxies = await prisma.heritageProxy.findMany({
    where: {
      venueId,
      ...(sceneId ? { sceneId } : {}),
      ...(staleOnly ? { invalidatedAt: { not: null } } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      object: { select: { id: true, slug: true, title: true } },
      scene: { select: { id: true, slug: true, title: true } },
    },
  });
  return NextResponse.json({ proxies });
}

const ProxyInput = z.object({
  sceneId: z.string().min(1),
  objectId: z.string().nullable().optional(),
  shape: z.enum(SHAPES).default("box"),
  interaction: z.enum(INTERACTIONS).default("info"),
  transform: transformSchema,
  geometryUrl: z.string().url().nullable().optional(),
  label: localized.optional(),
  href: z.string().max(2000).nullable().optional(),
  sortOrder: z.number().int().default(0),
});

/** Accept one proxy or a batch; the response shape follows the request. */
const CreateBody = z.union([ProxyInput, z.array(ProxyInput).min(1).max(500)]);

export async function POST(
  req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { venueId } = await params;
  const access = await requireVenueAccess(venueId, "write");
  if (access.denied) return access.denied;

  const parsed = await readJson(req, CreateBody);
  if ("error" in parsed) return parsed.error;
  const inputs = Array.isArray(parsed.data) ? parsed.data : [parsed.data];

  // Verify every distinct scene and object exactly once rather than per row —
  // a 500-proxy bulk place would otherwise issue 1,000 lookups.
  const sceneIds = [...new Set(inputs.map((i) => i.sceneId))];
  const objectIds = [
    ...new Set(inputs.map((i) => i.objectId).filter((v): v is string => !!v)),
  ];
  for (const sceneId of sceneIds) {
    const err = await assertVenueScoped(venueId, { sceneId });
    if (err) return err;
  }
  for (const objectId of objectIds) {
    const err = await assertVenueScoped(venueId, { objectId });
    if (err) return err;
  }

  return guarded(async () => {
    const created = await prisma.$transaction(
      inputs.map((input) =>
        prisma.heritageProxy.create({
          data: { venueId, ...input } as never,
          select: { id: true },
        }),
      ),
    );
    return NextResponse.json(
      Array.isArray(parsed.data) ? { ids: created.map((c) => c.id) } : created[0],
      { status: 201 },
    );
  });
}
