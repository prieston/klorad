/**
 * `POST /api/public/worlds/[slug]/unsubscribe`
 *   Body: { endpoint }
 *
 * Anonymous — drops the matching subscription row. No-op when the
 * endpoint isn't in the world (browser may have unsubscribed on
 * another tab). Always returns `ok: true` so the client doesn't need
 * to differentiate.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { loadWorldForPushViewer } from "@/lib/mobility/world-resolver";
import { recordWorldEvent } from "@/lib/mobility/world-events";

type Params = Promise<{ slug: string }>;

const Body = z.object({
  endpoint: z.string().url().max(2_000),
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
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  await prisma.mobilityWorldPushSubscription.deleteMany({
    where: { worldId: world.id, endpoint: parsed.data.endpoint },
  });
  await recordWorldEvent({
    worldId: world.id,
    kind: "push_unsubscribe",
    anonId: parsed.data.anonId ?? null,
  });
  return NextResponse.json({ ok: true });
}
