/**
 * Per-world analytics helpers — append events + roll them up for the
 * operator dashboard.
 *
 * Events are append-only; the operator panel reads aggregations not
 * the raw stream. `anonId` is a per-visitor opaque id held in the
 * browser's localStorage and only used to dedupe uniques within a
 * rolling 7-day window. We never look up a person from it.
 */
import { prisma } from "@/lib/prisma";
import type { MobilityWorldEventKind } from "@prisma/client";

export interface RecordEventOptions {
  worldId: string;
  kind: MobilityWorldEventKind;
  anonId?: string | null;
  meta?: Record<string, unknown> | null;
}

/**
 * Append an event. Best-effort: a failure here mustn't block the
 * caller (a subscribe API call still succeeds even if event logging
 * trips), so callers .catch() this and ignore.
 */
export async function recordWorldEvent(
  opts: RecordEventOptions,
): Promise<void> {
  await prisma.mobilityWorldEvent
    .create({
      data: {
        worldId: opts.worldId,
        kind: opts.kind,
        anonId: opts.anonId ?? null,
        meta: (opts.meta ?? undefined) as never,
      },
    })
    .catch(() => undefined);
}

export interface WorldStats {
  /** Total push subscribers right now (live count, not from events). */
  subscribers: number;
  /** Distinct `anonId` views in the last 7 days. */
  views7d: number;
  /** Distinct `anonId` installs (lifetime — installs are rare). */
  installs: number;
  /** Total broadcasts sent (lifetime). */
  broadcastCount: number;
  /** Most recent broadcast ISO timestamp; null when none. */
  lastBroadcastAt: string | null;
}

/**
 * Compute the stats panel — three queries packed into a $transaction
 * to keep round trips down. Returns zeroes for a brand-new world.
 */
export async function getWorldStats(worldId: string): Promise<WorldStats> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [subscribers, views7dRows, installsRows, broadcasts] =
    await prisma.$transaction([
      prisma.mobilityWorldPushSubscription.count({ where: { worldId } }),
      prisma.mobilityWorldEvent.findMany({
        where: {
          worldId,
          kind: "view",
          createdAt: { gte: sevenDaysAgo },
          NOT: { anonId: null },
        },
        distinct: ["anonId"],
        select: { anonId: true },
      }),
      prisma.mobilityWorldEvent.findMany({
        where: {
          worldId,
          kind: "install",
          NOT: { anonId: null },
        },
        distinct: ["anonId"],
        select: { anonId: true },
      }),
      prisma.mobilityWorldEvent.findMany({
        where: { worldId, kind: "broadcast_sent" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      }),
    ]);

  const broadcastCount = await prisma.mobilityWorldEvent.count({
    where: { worldId, kind: "broadcast_sent" },
  });

  return {
    subscribers,
    views7d: views7dRows.length,
    installs: installsRows.length,
    broadcastCount,
    lastBroadcastAt: broadcasts[0]?.createdAt.toISOString() ?? null,
  };
}
