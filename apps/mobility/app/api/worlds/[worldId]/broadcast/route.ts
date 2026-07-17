/**
 * `POST /api/worlds/[worldId]/broadcast`
 *   Body: { title, body, deviceIds?, url?, tag? }
 *
 * Operator-only — fan-outs an ad-hoc push to every subscriber of the
 * world and persists a `Broadcast` row so the visitor's notifications
 * history page has something to render.
 *
 * `deviceIds`, when set, are validated against the world's device
 * list and baked into the push URL as `?devices=id1,id2` — the map
 * uses that param to highlight those pins + fit-to-bounds. The
 * visitor tapping the notification lands on the map with the
 * relevant devices already selected. Empty / omitted `deviceIds`
 * degrades to a plain `/w/<slug>` link.
 *
 * Requires `write` access on the project — this is a stakeholder-
 * visible action, so it's gated to operators, not the wider org.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireProjectAccess } from "@/lib/authz";
import { pushEnabled, sendPushToWorld } from "@/lib/mobility/world-push";
import { recordWorldEvent } from "@/lib/mobility/world-events";

type Params = Promise<{ worldId: string }>;

const Body = z.object({
  title: z.string().min(1).max(80),
  body: z.string().min(1).max(280),
  deviceIds: z.array(z.string().min(1)).max(50).optional(),
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

  // Validate device IDs against the world's device set so an operator
  // can't inject an id from a neighbouring world (or a stale id from
  // a deleted device — the visitor map would then hunt for a pin that
  // isn't in the geojson). Order is preserved from the client payload.
  let deviceIds: string[] = [];
  if (parsed.data.deviceIds && parsed.data.deviceIds.length > 0) {
    const requested = Array.from(new Set(parsed.data.deviceIds));
    const rows = await prisma.mobilityWorldDevice.findMany({
      where: { worldId, deviceId: { in: requested } },
      select: { deviceId: true },
    });
    const allowed = new Set(rows.map((r) => r.deviceId));
    deviceIds = requested.filter((id) => allowed.has(id));
  }

  // Deep-link the notification back to the map — the SW's
  // `notificationclick` handler navigates to this URL on tap, and
  // `WorldViewer` reads `?devices=` to highlight + fit-to-bounds.
  const targetPath =
    parsed.data.url
      ?? (deviceIds.length > 0
        ? `/w/${world.slug}?devices=${deviceIds.map(encodeURIComponent).join(",")}`
        : `/w/${world.slug}`);

  const session = await auth();
  const senderId = (session?.user?.id as string | undefined) ?? null;

  const result = await sendPushToWorld(worldId, {
    title: parsed.data.title,
    body: parsed.data.body,
    url: targetPath,
    tag: parsed.data.tag,
  });

  // Persist a history row so the visitor `/w/<slug>/notifications`
  // feed and the operator's own audit page have something to render.
  // Counters are stamped from the push result; the tap-through count
  // (`opened`) is bumped separately by the SW's click handler.
  await prisma.broadcast.create({
    data: {
      projectId: world.projectId,
      worldId,
      title: parsed.data.title,
      body: parsed.data.body,
      targetPath,
      deviceIds,
      senderId,
      attempted: result.attempted,
      delivered: result.delivered,
      pruned: result.pruned,
    },
  });

  await recordWorldEvent({
    worldId,
    kind: "broadcast_sent",
    meta: {
      title: parsed.data.title,
      attempted: result.attempted,
      delivered: result.delivered,
      pruned: result.pruned,
      deviceCount: deviceIds.length,
    },
  });

  return NextResponse.json({ ok: true, ...result, deviceIds });
}
