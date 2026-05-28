import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pushEnabled } from "@/lib/push";

/**
 * POST /api/push/subscribe
 *
 * Anonymous endpoint a visitor's browser hits after `pushManager.subscribe()`.
 * Stores the `{ endpoint, p256dh, auth }` triple against a project, idempotent
 * by `(projectId, endpoint)`. No auth, no PII — we never know who they are.
 *
 * Request: { projectId, endpoint, keys: { p256dh, auth }, userAgent? }
 */
export async function POST(req: Request) {
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

  const projectId =
    typeof body.projectId === "string" ? body.projectId : "";
  const endpoint =
    typeof body.endpoint === "string" ? body.endpoint : "";
  const keys =
    body.keys && typeof body.keys === "object"
      ? (body.keys as Record<string, unknown>)
      : {};
  const p256dh = typeof keys.p256dh === "string" ? keys.p256dh : "";
  const auth = typeof keys.auth === "string" ? keys.auth : "";
  if (!projectId || !endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { error: "projectId, endpoint, keys.p256dh, keys.auth required" },
      { status: 400 },
    );
  }

  // Per-project FK check — anonymous, so we don't want a subscription
  // hanging off a non-existent / draft project.
  const project = await prisma.project.findFirst({
    where: { id: projectId, isPublished: true },
    select: { id: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Campus not found" }, { status: 404 });
  }

  const userAgent =
    typeof body.userAgent === "string"
      ? body.userAgent.slice(0, 500)
      : req.headers.get("user-agent")?.slice(0, 500) ?? null;

  await prisma.pushSubscription.upsert({
    where: {
      projectId_endpoint: { projectId, endpoint },
    },
    update: { p256dh, auth, userAgent },
    create: {
      projectId,
      endpoint,
      p256dh,
      auth,
      userAgent,
    },
  });

  return NextResponse.json({ ok: true });
}

/** Optional `DELETE /api/push/subscribe` — used when the browser unsubs. */
export async function DELETE(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const projectId =
    typeof body.projectId === "string" ? body.projectId : "";
  const endpoint =
    typeof body.endpoint === "string" ? body.endpoint : "";
  if (!projectId || !endpoint) {
    return NextResponse.json(
      { error: "projectId + endpoint required" },
      { status: 400 },
    );
  }
  await prisma.pushSubscription
    .delete({
      where: { projectId_endpoint: { projectId, endpoint } },
    })
    .catch(() => undefined);
  return NextResponse.json({ ok: true });
}
