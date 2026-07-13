/**
 * Shared "compose a broadcast, send the push, count the deliveries,
 * audit the send" helper. Extracted from `POST /api/maps/[mapId]/notify`
 * so the news / event create routes can fire an on-publish push
 * without duplicating the ~40 lines of pre-allocate + send + counter
 * update + audit boilerplate.
 *
 * Design notes:
 *   - The Broadcast row is pre-allocated so the push payload can
 *     carry `broadcastId` + `clickToken`. If the push send throws,
 *     the row stays at `attempted: 0` and the Reach screen shows it
 *     as "0/0 · queued" — a visible signal instead of a silent drop.
 *   - Every push failure per subscription is swallowed by
 *     `sendPushToProject`; the helper only rethrows when *nothing*
 *     could be sent at all (VAPID not configured).
 *   - Deep-link URLs are stored as campus-relative tails on the
 *     Broadcast row so the analytics survives a future URL-scheme
 *     change.
 */
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { pushEnabled, sendPushToProject } from "@/lib/push";
import { recordAudit } from "@/lib/audit";

export interface CreateBroadcastInput {
  mapId: string;
  organizationId: string;
  title: string;
  body: string;
  /** Absolute or campus-prefixed click-through URL. */
  url?: string;
  icon?: string;
  senderId?: string | null;
}

/** Single tagged discriminant so callers can switch/if-else cleanly.
 *  TypeScript's `"skipped" in result` narrowing gave up on the shape
 *  where two non-ok variants both had `ok: false`; a nominal
 *  `status` field is unambiguous. */
export type CreateBroadcastResult =
  | {
      status: "sent";
      broadcastId: string;
      attempted: number;
      delivered: number;
      pruned: number;
    }
  | {
      status: "skipped";
      reason: "push-disabled" | "no-subscribers";
    }
  | {
      status: "error";
      error: string;
      broadcastId?: string;
    };

/**
 * Send a push to every subscriber on `mapId` and persist the audit
 * trail. Non-throwing — inspect the result's `ok` flag. On success
 * the return also carries per-run counters for the caller (currently
 * unused but handy for a future toast on the admin).
 */
export async function createBroadcastAndSend(
  input: CreateBroadcastInput,
): Promise<CreateBroadcastResult> {
  if (!pushEnabled()) {
    return { status: "skipped", reason: "push-disabled" };
  }

  const {
    mapId,
    organizationId,
    title,
    body,
    url,
    icon,
    senderId,
  } = input;

  const clickToken = randomBytes(12).toString("base64url");

  const broadcast = await prisma.broadcast.create({
    data: {
      projectId: mapId,
      title,
      body,
      targetPath: extractCampusRelativePath(url, mapId),
      senderId: senderId ?? null,
      clickToken,
    },
    select: { id: true },
  });

  try {
    const result = await sendPushToProject(mapId, {
      title,
      body,
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
        console.error("[broadcast] count update failed", err);
      });

    await recordAudit({
      organizationId,
      projectId: mapId,
      actorId: senderId ?? null,
      entityType: "BROADCAST",
      entityId: broadcast.id,
      action: "CREATED",
      message: `Broadcast "${title}" — sent to ${result.delivered} of ${result.attempted}`,
      metadata: {
        attempted: result.attempted,
        delivered: result.delivered,
        pruned: result.pruned,
      },
    }).catch((err) => {
      console.error("[broadcast] audit failed", err);
    });

    return {
      status: "sent",
      broadcastId: broadcast.id,
      attempted: result.attempted,
      delivered: result.delivered,
      pruned: result.pruned,
    };
  } catch (err) {
    console.error("[broadcast] send failed", err);
    return {
      status: "error",
      error: err instanceof Error ? err.message : "Push failed",
      broadcastId: broadcast.id,
    };
  }
}

/**
 * A composer-provided URL might be absolute, campus-prefixed, or a
 * bare `/news/<id>` shorthand from a create-route caller. Store the
 * campus-relative tail on the Broadcast row so the history stays
 * valid if the public URL scheme changes (e.g. custom domains).
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
  if (path.startsWith(prefix)) {
    const tail = path.slice(prefix.length);
    return tail || "/";
  }
  // Callers from the news / event routes pass a bare `/news/<id>`
  // shorthand — keep it as-is; it's already campus-relative.
  if (path.startsWith("/")) return path;
  return null;
}

/** Compose the campus-scoped public URL for a news post. */
export function newsDeepLinkUrl(mapId: string, newsId: string): string {
  return `/campus/${mapId}/news/${newsId}`;
}

/** Compose the campus-scoped public URL for an event. */
export function eventDeepLinkUrl(mapId: string, eventId: string): string {
  return `/campus/${mapId}/events/${eventId}`;
}
