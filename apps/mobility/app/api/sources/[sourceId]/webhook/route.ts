/**
 * POST   /api/sources/[sourceId]/webhook — provision an inbound
 *   webhook so upstream events land on
 *   `/api/webhooks/inet-atms/[sourceId]`. Generates a random secret,
 *   persists it on the source, and POSTs to the upstream's webhook
 *   registry (mock: `POST {host}/api/webhooks`). Returns the URL +
 *   secret so the operator can also register it manually if the
 *   auto-provision hop fails.
 *
 * DELETE /api/sources/[sourceId]/webhook — clears the local secret /
 *   webhookId + best-effort DELETE against the upstream.
 *
 * Requires project `write` access — same bar as the sync toggle.
 */
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/authz";
import { decryptCredentials } from "@/lib/mobility/data-source";

type Params = Promise<{ sourceId: string }>;

/** Upstream event types the alert engine cares about. `vds.tick`
 *  fires 1Hz on the mock and is pure telemetry; skip it so the
 *  webhook consumer isn't spammed. */
const SUBSCRIBED_EVENTS = [
  "device.status_changed",
  "incident.posted",
  "incident.status_changed",
] as const;

function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3004"
  );
}

async function fetchSource(sourceId: string) {
  return prisma.mobilityDataSource.findUnique({
    where: { id: sourceId },
    select: {
      id: true,
      projectId: true,
      connectorId: true,
      config: true,
      credentialsEncrypted: true,
      webhookId: true,
    },
  });
}

export async function POST(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { sourceId } = await params;
  const source = await fetchSource(sourceId);
  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = await requireProjectAccess(source.projectId, "write");
  if (denied) return denied;

  if (source.connectorId !== "inet-atms") {
    return NextResponse.json(
      { error: "Webhook auto-provision only supports the iNET-ATMS connector" },
      { status: 400 },
    );
  }

  const config = (source.config ?? {}) as { host?: string };
  const host = (config.host ?? "").replace(/\/$/, "");
  if (!host) {
    return NextResponse.json(
      { error: "Source has no host configured" },
      { status: 400 },
    );
  }

  const secret = randomBytes(24).toString("hex");
  const deliveryUrl = `${baseUrl()}/api/webhooks/inet-atms/${sourceId}`;

  const creds = decryptCredentials(source.credentialsEncrypted);
  const authHeader = basicAuthHeader(creds);
  const upstreamRes = await fetch(`${host}/api/webhooks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body: JSON.stringify({
      url: deliveryUrl,
      events: SUBSCRIBED_EVENTS,
      secret,
    }),
  }).catch(() => null);

  if (!upstreamRes) {
    return NextResponse.json(
      {
        error: "Could not reach the upstream to auto-register the webhook",
        // Return the secret + URL anyway so the operator can register
        // it manually via the mock's picker if they choose.
        deliveryUrl,
        secret,
      },
      { status: 502 },
    );
  }
  if (!upstreamRes.ok) {
    return NextResponse.json(
      {
        error: `Upstream refused the registration (${upstreamRes.status})`,
        deliveryUrl,
        secret,
      },
      { status: 502 },
    );
  }

  const body = (await upstreamRes.json().catch(() => ({}))) as {
    id?: string;
  };

  // Persist last so a mid-flight failure above doesn't leave the
  // source pointing at a webhook it never provisioned.
  await prisma.mobilityDataSource.update({
    where: { id: sourceId },
    data: { webhookSecret: secret, webhookId: body.id ?? null },
  });

  return NextResponse.json({
    ok: true,
    deliveryUrl,
    webhookId: body.id ?? null,
    // Return the secret exactly once so it's visible in the picker's
    // response toast. Subsequent GETs never expose it.
    secret,
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { sourceId } = await params;
  const source = await fetchSource(sourceId);
  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const denied = await requireProjectAccess(source.projectId, "write");
  if (denied) return denied;

  const config = (source.config ?? {}) as { host?: string };
  const host = (config.host ?? "").replace(/\/$/, "");
  const creds = decryptCredentials(source.credentialsEncrypted);
  const authHeader = basicAuthHeader(creds);

  // Best-effort upstream cleanup — if the mock is down or unreachable,
  // still clear the local record so the operator can re-register.
  if (host && source.webhookId) {
    await fetch(`${host}/api/webhooks/${source.webhookId}`, {
      method: "DELETE",
      headers: authHeader ? { Authorization: authHeader } : undefined,
    }).catch(() => null);
  }

  await prisma.mobilityDataSource.update({
    where: { id: sourceId },
    data: { webhookSecret: null, webhookId: null },
  });

  return NextResponse.json({ ok: true });
}

function basicAuthHeader(
  creds: Record<string, unknown> | null,
): string | null {
  const username = typeof creds?.username === "string" ? creds.username : null;
  const password = typeof creds?.password === "string" ? creds.password : null;
  if (!username && !password) return null;
  return `Basic ${Buffer.from(`${username ?? ""}:${password ?? ""}`).toString("base64")}`;
}
