import { NextResponse } from "next/server";
import { requireCampusAccess } from "@/lib/authz";
import { pushEnabled, sendPushToProject } from "@/lib/push";

type Params = Promise<{ mapId: string }>;

/**
 * POST /api/maps/[mapId]/notify
 *
 * Admin-triggered web push to every subscriber on this campus. Body:
 *   { title: string, body: string, url?: string, icon?: string }
 *
 * Returns counts: `{ attempted, delivered, pruned }`. Subscriptions
 * that respond 404 / 410 are pruned in-line — anything else is logged
 * and the row stays in case it was transient.
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
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error("[notify]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Push failed" },
      { status: 500 },
    );
  }
}
