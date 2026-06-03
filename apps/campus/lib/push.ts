/**
 * Web push helpers — VAPID config + the per-project send loop.
 *
 * Subscriptions are anonymous: stored as `{ endpoint, p256dh, auth }`
 * scoped to a `Project`, no PII attached. The send loop fans out via
 * `web-push.sendNotification` and prunes subscriptions that come back
 * with `410 Gone` / `404` (the browser unsubscribed or rotated keys).
 *
 * Env:
 *   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — VAPID public key (client uses it
 *     to subscribe; server uses it to sign).
 *   - `VAPID_PRIVATE_KEY` — server-only signing key.
 *   - `VAPID_SUBJECT` — `mailto:` URL the push services contact you at.
 *
 * Generate keys once: `npx web-push generate-vapid-keys --json`.
 */
import webpush from "web-push";
import { prisma } from "@/lib/prisma";

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export function pushEnabled(): boolean {
  return ensureConfigured();
}

export interface PushPayload {
  title: string;
  body: string;
  /** Click-through URL on the campus. Absolute or path. */
  url?: string;
  /** Optional thumbnail; falls back to the campus icon. */
  icon?: string;
  /** Broadcast.id — the service worker forwards this back to the
   *  open-count endpoint on notificationclick. */
  broadcastId?: string;
  /** One-time token paired with `broadcastId` so the counter
   *  endpoint can reject replayed URLs. */
  clickToken?: string;
}

export interface PushSendResult {
  attempted: number;
  delivered: number;
  pruned: number;
}

/**
 * Send `payload` to every subscription on `projectId`. Errors per
 * subscription don't abort the run — bad subscriptions get pruned.
 */
export async function sendPushToProject(
  projectId: string,
  payload: PushPayload,
): Promise<PushSendResult> {
  if (!ensureConfigured()) {
    throw new Error(
      "Push is not configured — set VAPID_* env vars first.",
    );
  }

  const subs = await prisma.pushSubscription.findMany({
    where: { projectId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  let delivered = 0;
  let pruned = 0;
  const serialized = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          serialized,
        );
        delivered += 1;
      } catch (err: unknown) {
        const status =
          err && typeof err === "object" && "statusCode" in err
            ? Number((err as { statusCode?: number }).statusCode)
            : 0;
        // 404 / 410 mean the subscription is dead. Anything else is
        // transient — leave the row alone, we'll try again next send.
        if (status === 404 || status === 410) {
          await prisma.pushSubscription
            .delete({ where: { id: s.id } })
            .catch(() => undefined);
          pruned += 1;
        } else {
          console.error("[push] send failed", { id: s.id, err });
        }
      }
    }),
  );

  return { attempted: subs.length, delivered, pruned };
}
