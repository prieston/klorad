import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { auth } from "@/auth";
import { requireCampusAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { pushEnabled, sendPushToProject } from "@/lib/push";

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

  // Pre-allocate the broadcast row so the push payload can carry its
  // id. If anything fails before the send, the row is left with
  // `attempted: 0` which the Reach UI renders as a "0/0 · queued"
  // line — surfacing the failed send instead of hiding it.
  const clickToken = randomBytes(12).toString("base64url");
  const session = await auth();
  const broadcast = await prisma.broadcast.create({
    data: {
      projectId: mapId,
      title,
      body: message,
      targetPath: extractCampusRelativePath(url, mapId),
      senderId: (session?.user?.id as string | undefined) ?? null,
      clickToken,
    },
    select: { id: true },
  });

  try {
    const result = await sendPushToProject(mapId, {
      title,
      body: message,
      url,
      icon,
      broadcastId: broadcast.id,
      clickToken,
    });

    await prisma.broadcast
      .update({
        where: { id: broadcast.id },
        data: {
          attempted: result.attempted,
          delivered: result.delivered,
          pruned: result.pruned,
        },
      })
      .catch((err) => {
        console.error("[notify] count update failed", err);
      });

    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error("[notify]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Push failed" },
      { status: 500 },
    );
  }
}

/**
 * The Reach composer sends an absolute-or-campus-prefixed URL like
 * `/campus/<mapId>/events`. We store the campus-relative tail so
 * future history rows stay valid if the public URL scheme moves
 * (e.g. custom domains). Returns `null` when the URL doesn't look
 * like a campus link.
 */
function extractCampusRelativePath(
  url: string | undefined,
  mapId: string,
): string | null {
  if (!url) return null;
  let path = url;
  try {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      path = new URL(url).pathname;
    }
  } catch {
    return null;
  }
  const prefix = `/campus/${mapId}`;
  if (!path.startsWith(prefix)) return null;
  const tail = path.slice(prefix.length);
  return tail || "/";
}
