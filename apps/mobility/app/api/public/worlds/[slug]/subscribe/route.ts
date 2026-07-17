/**
 * `POST /api/public/worlds/[slug]/subscribe`
 *   Body: { endpoint, p256dh, auth }
 *
 * Anonymous endpoint — registers a browser push subscription for the
 * world. Idempotent: re-subscribing with the same `endpoint` upserts
 * the existing row (browsers rotate keys, so we replace p256dh/auth
 * on each call). User-agent is captured for the operator's analytics
 * surface in PR5 — never used for routing.
 *
 * The slug round-trips through the world resolver, so drafts /
 * `authenticated` worlds 404 — a browser that's subscribed to a
 * world that's later unpublished will continue to receive nothing
 * (no rows match in the send loop), and re-subscribe will quietly
 * fail with 404.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { loadWorldForPushViewer } from "@/lib/mobility/world-resolver";
import { recordWorldEvent } from "@/lib/mobility/world-events";

type Params = Promise<{ slug: string }>;

const Body = z.object({
  endpoint: z.string().url().max(2_000),
  p256dh: z.string().min(1).max(500),
  auth: z.string().min(1).max(500),
  anonId: z.string().min(8).max(64).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { slug } = await params;
  const world = await loadWorldForPushViewer(slug);
  if (!world) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { endpoint, p256dh, auth } = parsed.data;
  const userAgent = req.headers.get("user-agent")?.slice(0, 240) ?? null;

  // Upsert by endpoint — the same browser re-subscribing replaces its
  // own row. If a different world owned this endpoint it'd be a
  // collision (endpoint is globally unique), so we delete the prior
  // row and recreate against this world. That's intentional: a browser
  // moving from world A → world B should belong to B only.
  await prisma.$transaction([
    prisma.mobilityWorldPushSubscription.deleteMany({
      where: { endpoint, NOT: { worldId: world.id } },
    }),
    prisma.mobilityWorldPushSubscription.upsert({
      where: { endpoint },
      create: { worldId: world.id, endpoint, p256dh, auth, userAgent },
      update: { p256dh, auth, userAgent },
    }),
  ]);

  await recordWorldEvent({
    worldId: world.id,
    kind: "push_subscribe",
    anonId: parsed.data.anonId ?? null,
  });

  return NextResponse.json({ ok: true });
}
