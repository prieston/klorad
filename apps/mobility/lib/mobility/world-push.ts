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
  if (!isValidVapidPublicKey(publicKey)) {
    console.warn(
      "[world-push] NEXT_PUBLIC_VAPID_PUBLIC_KEY is set but doesn't look like a P-256 point (65 decoded bytes, 0x04 prefix). Push disabled.",
    );
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export function pushEnabled(): boolean {
  return ensureConfigured();
}

/** Only exposes the key when it's structurally valid. Prevents a
 *  misconfigured Vercel env (e.g. someone pasting the env var name
 *  as the value) from being served to browsers, which just makes
 *  `pushManager.subscribe` hang silently in Chrome. */
export function getVapidPublicKey(): string | null {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key || !isValidVapidPublicKey(key)) return null;
  return key;
}

/** Validate the base64url shape of a VAPID public key. A valid key
 *  is exactly 65 bytes when decoded (0x04 uncompressed prefix +
 *  32-byte X + 32-byte Y for a P-256 point) and its base64url form
 *  is ~87 chars. Rejects both empty / null and the "someone pasted
 *  the env var name as the value" failure mode that used to slip
 *  through and hang the client. */
export function isValidVapidPublicKey(raw: string): boolean {
  if (!raw || raw.length < 80 || raw.length > 100) return false;
  // Base64url uses `-_` in place of `+/`; also accept the standard
  // form and padded variants because `web-push generate-vapid-keys`
  // and hand-copies sometimes drop or add `=`.
  if (!/^[A-Za-z0-9\-_+/=]+$/.test(raw)) return false;
  try {
    const pad = "=".repeat((4 - (raw.length % 4)) % 4);
    const normalised = (raw + pad).replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Buffer.from(normalised, "base64");
    return bytes.length === 65 && bytes[0] === 0x04;
  } catch {
    return false;
  }
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
