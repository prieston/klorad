import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { requireCampusAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { pushEnabled } from "@/lib/push";
import { createBroadcastAndSend } from "@/lib/broadcast";

type Params = Promise<{ mapId: string }>;

/**
 * POST /api/maps/[mapId]/notify
 *
 * Admin-triggered web push to every subscriber on this campus. Body:
 *   { title: string, body: string, url?: string, icon?: string }
 *
 * Flow: we pre-allocate a `Broadcast` row *before* sending so the
 * push payload can carry a stable broadcastId + clickToken; the
 * service worker reports each notificationclick back, and that's
 * how the Reach screen's open rate is built. After
 * `sendPushToProject` resolves we update the same row with the
 * attempted / delivered / pruned counters.
 *
 * Returns `{ attempted, delivered, pruned }` in `result`. The
 * broadcast row's id is never exposed to the rector — they don't
 * need it and unique-ish ids in client responses are an
 * enumeration vector.
 */
export async function POST(req: Request, { params }: { params: Params }) {
  const { mapId } = await params;
  const denied = await requireCampusAccess(mapId, "write");
  if (denied) return denied;

  if (!pushEnabled()) {
    return NextResponse.json(
      { error: "Push isn't configured on this server." },
      { status: 503 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const message = typeof body.body === "string" ? body.body.trim() : "";
  if (!title || !message) {
    return NextResponse.json(
      { error: "title and body required" },
      { status: 400 },
    );
  }
  const url = typeof body.url === "string" ? body.url : undefined;
  const icon = typeof body.icon === "string" ? body.icon : undefined;

  const session = await auth();
  const project = await prisma.project.findUnique({
    where: { id: mapId },
    select: { organizationId: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Campus not found" }, { status: 404 });
  }

  const outcome = await createBroadcastAndSend({
    mapId,
    organizationId: project.organizationId,
    title,
    body: message,
    url,
    icon,
    senderId: (session?.user?.id as string | undefined) ?? null,
  });

  if (outcome.ok) {
    return NextResponse.json({
      ok: true,
      result: {
        attempted: outcome.attempted,
        delivered: outcome.delivered,
        pruned: outcome.pruned,
      },
    });
  }

  const status = "skipped" in outcome && outcome.skipped === "push-disabled" ? 503 : 500;
  const errorMessage =
    "skipped" in outcome
      ? outcome.skipped === "push-disabled"
        ? "Push isn't configured on this server."
        : "Broadcast skipped."
      : outcome.error;
  return NextResponse.json({ error: errorMessage }, { status });
}
