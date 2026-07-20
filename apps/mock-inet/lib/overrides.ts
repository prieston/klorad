/**
 * Per-device status overrides driven by demo scenarios. Persisted to
 * Postgres (`MockStatusOverride` table) — was a module-level `Map`
 * that broke on Vercel serverless the same way the webhook registry
 * did: a scenario POST set the override on one instance, but every
 * other instance saw baseline values on `/status` reads, so the
 * Mobility drawer view diverged from the alert row it just fired.
 *
 * TTL is enforced at read time (`WHERE expiresAt > NOW()`). Expired
 * rows are best-effort deleted on read so the table doesn't grow
 * unbounded — demo scale (max ~10 concurrent overrides) doesn't
 * warrant a scheduled cleanup.
 */
import { prisma } from "./prisma";

// The workspace's shared Prisma singleton is typed as `any` to work
// around the Accelerate extension's union-type inference (see
// `packages/prisma/index.ts`), so the JSON column doesn't need a
// strict `InputJsonValue` cast. Plain object shapes flow through.

export interface StatusOverride {
  /** Epoch ms after which the override is discarded. */
  expiresAt: number;
  /** Fields merged over the base status shape by `currentStatus()`. */
  patch: Record<string, unknown>;
  /** Human-readable label surfaced by the /overrides debug endpoint. */
  reason: string;
}

export async function setOverride(
  externalId: string,
  patch: Record<string, unknown>,
  durationMs: number,
  reason: string,
): Promise<void> {
  const expiresAt = new Date(Date.now() + durationMs);
  // Prisma's InputJsonValue is a union of JSON primitives + arrays +
  // objects; `Record<string, unknown>` isn't structurally assignable
  // without a cast even though every real payload we send is valid
  // JSON. Cast at the boundary keeps callers ergonomic.
  const patchJson = patch as unknown as Parameters<
    typeof prisma.mockStatusOverride.upsert
  >[0]["create"]["patch"];
  await prisma.mockStatusOverride.upsert({
    where: { externalId },
    create: {
      externalId,
      patch: patchJson,
      reason,
      expiresAt,
    },
    update: {
      patch: patchJson,
      reason,
      expiresAt,
    },
  });
}

/** Return the active override for a device, or `null` if none/expired.
 *  Purges an expired row as a side effect. */
export async function getOverride(
  externalId: string,
): Promise<StatusOverride | null> {
  const row = await prisma.mockStatusOverride.findUnique({
    where: { externalId },
  });
  if (!row) return null;
  const expiresAt = row.expiresAt.getTime();
  if (expiresAt < Date.now()) {
    await prisma.mockStatusOverride
      .delete({ where: { externalId } })
      .catch(() => undefined);
    return null;
  }
  return {
    expiresAt,
    patch: row.patch as Record<string, unknown>,
    reason: row.reason,
  };
}

export async function clearOverride(externalId: string): Promise<void> {
  await prisma.mockStatusOverride
    .delete({ where: { externalId } })
    .catch(() => undefined);
}

/** For the /overrides debug endpoint — list every non-expired override.
 *  Purges expired rows opportunistically so the caller only sees hot
 *  entries. */
export async function activeOverrides(): Promise<
  Array<{
    externalId: string;
    expiresAt: number;
    reason: string;
    patch: Record<string, unknown>;
  }>
> {
  const now = new Date();
  // Prune the tail first — a single DELETE is cheaper than filtering
  // in application code, and keeps the table tidy for the demo panel.
  await prisma.mockStatusOverride
    .deleteMany({ where: { expiresAt: { lt: now } } })
    .catch(() => undefined);
  const rows = await prisma.mockStatusOverride.findMany({
    where: { expiresAt: { gt: now } },
    orderBy: { expiresAt: "asc" },
  });
  return rows.map(
    (row: {
      externalId: string;
      expiresAt: Date;
      reason: string;
      patch: unknown;
    }) => ({
      externalId: row.externalId,
      expiresAt: row.expiresAt.getTime(),
      reason: row.reason,
      patch: row.patch as Record<string, unknown>,
    }),
  );
}
