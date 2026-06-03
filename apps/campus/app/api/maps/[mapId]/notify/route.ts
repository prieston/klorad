import { NextResponse } from "next/server";
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
 * Returns counts: `{ attempted, delivered, pruned }`. Subscriptions
 * that respond 404 / 410 are pruned in-line — anything else is
 * logged and the row stays in case it was transient.
 *
 * On success we also persist a `Broadcast` row so the Reach screen
 * can render history. We store the *campus-relative* path (e.g.
 * `/events`) rather than the absolute URL so deep-links survive a
 * change to the public URL scheme.
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

  try {
    const result = await sendPushToProject(mapId, {
      title,
      body: message,
      url,
      icon,
    });

    // Persist a history row. We deliberately *don't* fail the send
    // when the DB write fails — the notification already reached the
    // devices, missing history is recoverable.
    const session = await auth();
    await prisma.broadcast
      .create({
        data: {
          projectId: mapId,
          title,
          body: message,
          targetPath: extractCampusRelativePath(url, mapId),
          senderId:
            (session?.user?.id as string | undefined) ?? null,
          attempted: result.attempted,
          delivered: result.delivered,
          pruned: result.pruned,
        },
      })
      .catch((err) => {
        console.error("[notify] history insert failed", err);
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
 * like a campus link — there's nothing safe to deep-link to from
 * the history list in that case.
 */
function extractCampusRelativePath(
  url: string | undefined,
  mapId: string,
): string | null {
  if (!url) return null;
  // Accept either an absolute URL or a path. We only care about the
  // pathname for the relative tail.
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
