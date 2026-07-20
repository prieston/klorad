/**
 * Webhook registry + delivery. Same events that flow over SSE fan
 * out here via HTTP POST — HMAC-signed with the webhook's own secret.
 *
 * Registry is persisted to Postgres (`MockWebhook` table). Was
 * previously a module-level `Map` — that broke on Vercel serverless
 * because each instance had its own registry: mobility registered
 * with one warm instance, the scenario POST fired on a different
 * one, and the fan-out found no webhooks. Now every instance queries
 * the same table.
 *
 * Retry: 3 attempts with exponential back-off (1s / 5s / 30s). After
 * the third failure the webhook is marked inactive; the operator can
 * unregister + re-register it. `lastDeliveryAt` + `lastDeliveryStatus`
 * are best-effort — a race between two events can lose one of the
 * stamps, but the operator UI treats them as informational.
 */
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { prisma } from "./prisma";
import type {
  StreamEvent,
  StreamEventType,
  Webhook,
  WebhookCreate,
} from "./types";

interface MockWebhookRow {
  id: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  createdAt: Date;
  lastDeliveryAt: Date | null;
  lastDeliveryStatus: number | null;
}

export async function listWebhooks(): Promise<Webhook[]> {
  const rows: MockWebhookRow[] = await prisma.mockWebhook.findMany({
    orderBy: { createdAt: "asc" },
  });
  return rows.map(fromRow);
}

export async function registerWebhook(input: WebhookCreate): Promise<Webhook> {
  const id = randomUUID();
  const row = await prisma.mockWebhook.create({
    data: {
      id,
      url: input.url,
      events: [...input.events],
      secret: input.secret ?? randomBytes(24).toString("hex"),
      active: true,
    },
  });
  return fromRow(row);
}

export async function deleteWebhook(id: string): Promise<boolean> {
  try {
    await prisma.mockWebhook.delete({ where: { id } });
    return true;
  } catch {
    // Prisma throws P2025 when the row doesn't exist — treat as
    // "already gone" so the caller's contract (bool) is honoured.
    return false;
  }
}

/**
 * Fan `event` out to every active webhook whose `events` filter
 * includes the event's type. Non-blocking — errors are logged.
 * Reads the registry fresh on every event so a webhook registered
 * seconds ago on a different serverless instance is picked up
 * immediately.
 */
export async function deliverEvent(event: StreamEvent): Promise<void> {
  const targets: MockWebhookRow[] = await prisma.mockWebhook.findMany({
    where: {
      active: true,
      // Postgres text[] "has" — accepts the event type in the
      // whitelist. A future "*" wildcard should be added here if we
      // ever want a firehose subscriber.
      events: { has: event.type },
    },
  });
  await Promise.all(
    targets.map((row) => sendWithRetry(fromRow(row), event)),
  );
}

async function sendWithRetry(
  webhook: Webhook,
  event: StreamEvent,
): Promise<void> {
  const body = JSON.stringify(event);
  const signature = sign(webhook.secret, body);
  const backoffs = [1000, 5000, 30000];
  let lastStatus: number | null = null;
  for (let attempt = 0; attempt < backoffs.length; attempt += 1) {
    try {
      const res = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PSMdt-Event": event.type,
          "X-PSMdt-Signature": `sha256=${signature}`,
          "X-PSMdt-Delivery": webhook.id,
        },
        body,
      });
      lastStatus = res.status;
      await stampDelivery(webhook.id, res.status);
      if (res.ok) return;
      // 410 Gone → semantic deactivation. Any other 4xx / 5xx retries.
      if (res.status === 410) {
        await deactivate(webhook.id);
        return;
      }
    } catch (err) {
      // Network error — treat as retryable.
      console.error("[webhooks] delivery failed", webhook.id, err);
    }
    if (attempt < backoffs.length - 1) {
      await new Promise((r) => setTimeout(r, backoffs[attempt]));
    }
  }
  await deactivate(webhook.id);
  // Preserve the last observed status when giving up so the operator
  // UI still shows why the webhook was deactivated.
  if (lastStatus != null) {
    await stampDelivery(webhook.id, lastStatus);
  }
}

async function stampDelivery(id: string, status: number): Promise<void> {
  await prisma.mockWebhook
    .update({
      where: { id },
      data: { lastDeliveryAt: new Date(), lastDeliveryStatus: status },
    })
    .catch(() => undefined);
}

async function deactivate(id: string): Promise<void> {
  await prisma.mockWebhook
    .update({ where: { id }, data: { active: false } })
    .catch(() => undefined);
}

function sign(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

/** Map a Prisma row into the caller-facing `Webhook` shape. Keeps
 *  the JSON API stable even if the DB columns drift. */
function fromRow(row: MockWebhookRow): Webhook {
  return {
    id: row.id,
    url: row.url,
    // Postgres stores as plain `text[]` — the caller-facing type is
    // the discriminated union `StreamEventType[]`. Zod on the create
    // path already validates values against the union, so anything
    // we ever wrote to this column is a valid `StreamEventType`.
    events: row.events as StreamEventType[],
    secret: row.secret,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    lastDeliveryAt: row.lastDeliveryAt?.toISOString() ?? null,
    lastDeliveryStatus: row.lastDeliveryStatus,
  };
}
