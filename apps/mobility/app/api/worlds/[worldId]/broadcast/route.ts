/**
 * `POST /api/worlds/[worldId]/broadcast`
 *   Body: { title, body, url?, tag? }
 *
 * Operator-only — fan-outs an ad-hoc push to every subscriber of the
 * world. v1 use cases: maintenance announcements, weather advisories,
 * verifying the push pipeline end-to-end. PR5 layers analytics + open
 * counters; the durable alert engine (auto-fanout from `MobilityAlert`)
 * is its own follow-up arc.
 *
 * Requires `write` access on the project — this is a stakeholder-
 * visible action, so it's gated to operators, not the wider org.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/authz";
import { pushEnabled, sendPushToWorld } from "@/lib/mobility/world-push";
import { recordWorldEvent } from "@/lib/mobility/world-events";

type Params = Promise<{ worldId: string }>;

const Body = z.object({
  title: z.string().min(1).max(80),
  body: z.string().min(1).max(280),
  url: z.string().min(1).max(500).optional(),
  tag: z.string().max(40).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { worldId } = await params;
  const world = await prisma.mobilityWorld.findUnique({
    where: { id: worldId },
    select: { projectId: true, slug: true, isPublished: true },
  });
  if (!world) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!world.isPublished) {
    return NextResponse.json(
      { error: "World must be published before broadcasting." },
      { status: 409 },
    );
  }
  const denied = await requireProjectAccess(world.projectId, "write");
  if (denied) return denied;

  if (!pushEnabled()) {
    return NextResponse.json(
      {
        error:
          "Web push is not configured. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT.",
      },
      { status: 503 },
    );
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

  const result = await sendPushToWorld(worldId, {
    title: parsed.data.title,
    body: parsed.data.body,
    url: parsed.data.url ?? `/w/${world.slug}`,
    tag: parsed.data.tag,
  });

  await recordWorldEvent({
    worldId,
    kind: "broadcast_sent",
    meta: {
      title: parsed.data.title,
      // Persist the deep-link URL that was pushed so the operator's
      // "recent broadcasts" list can show where each notification
      // pointed. Defaults to the world root when the composer left
      // it blank (same fallback as the push payload itself).
      url: parsed.data.url ?? `/w/${world.slug}`,
      attempted: result.attempted,
      delivered: result.delivered,
      pruned: result.pruned,
    },
  });

  return NextResponse.json({ ok: true, ...result });
}
