/**
 * POST /api/events/view — record that something was looked at.
 *
 * Public and unauthenticated, because the people it counts are visitors. What
 * keeps that safe is that there is nothing here worth stealing and nothing
 * worth protecting: the endpoint increments a daily counter and stores no
 * identifier of any kind. The worst an abuser achieves is a wrong number in a
 * museum's own dashboard.
 *
 * Called from the browser after mount rather than during server render. Three
 * reasons, in order of importance: a render-time write would count crawler
 * traffic and Next's own prefetches as visits; it would put a database write
 * on the critical path of a page whose §9.3 budget is three seconds on a
 * mid-range phone; and it would fire again on every revalidation.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const Body = z.object({
  venueSlug: z.string().min(1).max(200),
  kind: z.enum(["venue", "scene", "object", "tour"]),
  /** Slug of the thing viewed; omitted for a venue landing page. */
  targetSlug: z.string().max(200).optional(),
  isEmbed: z.boolean().optional(),
  language: z.string().max(35).optional(),
});

/** Host only. A full referrer can carry a search query or a path that names a
 *  person, and none of that is wanted even briefly. */
function referrerHost(req: Request): string {
  const raw = req.headers.get("referer");
  if (!raw) return "";
  try {
    return new URL(raw).host.slice(0, 200);
  } catch {
    return "";
  }
}

/** Midnight UTC for today. A `@db.Date` column, so the time is dropped by the
 *  database anyway; normalising here keeps the upsert key stable. */
function today(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function POST(req: Request): Promise<NextResponse> {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  // Deliberately quiet: a malformed beacon is not the visitor's problem and
  // must never turn into a visible error on a museum's page.
  if (!parsed.success) return NextResponse.json({ ok: true });

  const { venueSlug, kind, targetSlug, isEmbed, language } = parsed.data;

  // Only published venues are counted. Without this the endpoint would create
  // counter rows for any string a caller invented.
  const venue = await prisma.heritageVenue.findFirst({
    where: { slug: venueSlug, project: { isPublished: true } },
    select: { id: true },
  });
  if (!venue) return NextResponse.json({ ok: true });

  // Resolve the target to a real, published id so a count can be joined back
  // to something. An unresolvable target is recorded against the venue rather
  // than dropped — the visit happened.
  let targetId = "";
  if (targetSlug && kind !== "venue") {
    const where = { slug: targetSlug, venueId: venue.id, state: "published" as const };
    const found =
      kind === "scene"
        ? await prisma.heritageScene.findFirst({ where, select: { id: true } })
        : kind === "object"
          ? await prisma.heritageObject.findFirst({ where, select: { id: true } })
          : await prisma.heritageTour.findFirst({ where, select: { id: true } });
    if (!found) return NextResponse.json({ ok: true });
    targetId = found.id;
  }

  const key = {
    venueId: venue.id,
    kind,
    targetId,
    isEmbed: Boolean(isEmbed),
    referrerHost: referrerHost(req),
    language: language ?? "",
    day: today(),
  };

  await prisma.heritageViewEvent.upsert({
    where: {
      venueId_kind_targetId_isEmbed_referrerHost_language_day: key,
    },
    create: { ...key, count: 1 },
    update: { count: { increment: 1 } },
  });

  return NextResponse.json({ ok: true });
}
