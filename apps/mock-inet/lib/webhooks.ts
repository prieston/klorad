/**
 * Webhook registry + delivery. Same events that flow over SSE fan
 * out here via HTTP POST — HMAC-signed with the webhook's own secret.
 *
 * Retry: 3 attempts with exponential back-off (1s / 5s / 30s). After
 * the third failure the webhook is marked inactive; the operator can
 * unregister + re-register it.
 */
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import type { StreamEvent, Webhook, WebhookCreate } from "./types";

const registry: Map<string, Webhook> = new Map();

export function listWebhooks(): Webhook[] {
  return Array.from(registry.values());
}

export function registerWebhook(input: WebhookCreate): Webhook {
  const id = randomUUID();
  const wh: Webhook = {
    id,
    url: input.url,
    events: [...input.events],
    secret: input.secret ?? randomBytes(24).toString("hex"),
    active: true,
    createdAt: new Date().toISOString(),
    lastDeliveryAt: null,
    lastDeliveryStatus: null,
  };
  registry.set(id, wh);
  return wh;
}

export function deleteWebhook(id: string): boolean {
  return registry.delete(id);
}

/**
 * Fan `event` out to every active webhook whose `events` filter
 * includes the event's type. Non-blocking — errors are logged.
 */
export async function deliverEvent(event: StreamEvent): Promise<void> {
  const targets = Array.from(registry.values()).filter(
    (w) => w.active && w.events.includes(event.type),
  );
  await Promise.all(targets.map((w) => sendWithRetry(w, event)));
}

async function sendWithRetry(webhook: Webhook, event: StreamEvent): Promise<void> {
  const body = JSON.stringify(event);
  const signature = sign(webhook.secret, body);
  const backoffs = [1000, 5000, 30000];
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
      webhook.lastDeliveryAt = new Date().toISOString();
      webhook.lastDeliveryStatus = res.status;
      if (res.ok) return;
      // 2xx failure — the subscriber should stop retrying. 4xx / 5xx
      // are considered transient except 410 Gone (semantic
      // deactivation) which disables the webhook immediately.
      if (res.status === 410) {
        webhook.active = false;
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
  webhook.active = false;
}

function sign(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}
