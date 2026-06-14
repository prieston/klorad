/**
 * Per-world Web Push — VAPID config, subscription persistence, and
 * the per-world send loop. Mirrors apps/campus/lib/push.ts but keyed
 * off `MobilityWorld` rather than `Project`: each world has its own
 * subscription pool, scoped to a stakeholder PWA at `/w/<slug>/`.
 *
 * Subscriptions are fully anonymous — only `{ endpoint, p256dh, auth }`
 * plus an optional `userAgent` string for the operator's analytics
 * page in PR5. No PII.
 *
 * Env (all three required to enable push):
 *   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — client subscribes with this.
 *   - `VAPID_PRIVATE_KEY`            — server signing key.
 *   - `VAPID_SUBJECT`                — `mailto:` URL push services
 *                                       contact you at on bounce.
 *
 * Generate once: `npx web-push generate-vapid-keys --json`.
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

export function getVapidPublicKey(): string | null {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null;
}

export interface WorldPushPayload {
  title: string;
  body: string;
  /** Click-through URL (path or absolute) — defaults to `/w/<slug>`. */
  url?: string;
  /** Optional icon override; falls back to the world's manifest icon. */
  icon?: string;
  /** Optional grouping tag — repeat-pushes with the same tag collapse. */
  tag?: string;
}

export interface WorldPushResult {
  attempted: number;
  delivered: number;
  pruned: number;
}

/**
 * Fan `payload` out to every subscription on `worldId`. Per-sub
 * errors don't abort the batch — bad subscriptions (HTTP 404 / 410)
 * get pruned in place; transient failures are logged and retried on
 * the next send. Successful deliveries stamp `lastNotifiedAt` so the
 * operator analytics page can flag dormant subs.
 */
export async function sendPushToWorld(
  worldId: string,
  payload: WorldPushPayload,
): Promise<WorldPushResult> {
  if (!ensureConfigured()) {
    throw new Error("Push is not configured — set VAPID_* env vars first.");
  }

  const subs = await prisma.mobilityWorldPushSubscription.findMany({
    where: { worldId },
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
        // Best-effort stamp — a failed update mustn't tank the batch
        // (e.g. another concurrent prune removed the row).
        await prisma.mobilityWorldPushSubscription
          .update({ where: { id: s.id }, data: { lastNotifiedAt: new Date() } })
          .catch(() => undefined);
      } catch (err: unknown) {
        const status =
          err && typeof err === "object" && "statusCode" in err
            ? Number((err as { statusCode?: number }).statusCode)
            : 0;
        if (status === 404 || status === 410) {
          await prisma.mobilityWorldPushSubscription
            .delete({ where: { id: s.id } })
            .catch(() => undefined);
          pruned += 1;
        } else {
          console.warn("[world-push] send failed", { id: s.id, status });
        }
      }
    }),
  );

  return { attempted: subs.length, delivered, pruned };
}
