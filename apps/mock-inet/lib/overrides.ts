/**
 * Per-device status overrides driven by demo scenarios. Overrides
 * live in-memory with an expiry timestamp — `currentStatus()` merges
 * them on top of the deterministic base status so a scripted scenario
 * (radar slowdown, DMS alarm, incident cascade) shows up on every
 * subsequent `/status` call until the override lapses.
 *
 * Vercel serverless quirk (same one that applies to the event bus):
 * each cold instance has its own overrides map. For a demo where the
 * scenario POST and the /status GET land on the same warm instance
 * this is fine; the connector polling on 15s intervals will hit the
 * same instance within the demo window.
 */
export interface StatusOverride {
  /** Epoch ms after which the override is discarded. */
  expiresAt: number;
  /** Fields merged over the base status shape by `currentStatus()`. */
  patch: Record<string, unknown>;
  /** Human-readable label surfaced by the /overrides debug endpoint. */
  reason: string;
}

const overrides = new Map<string, StatusOverride>();

export function setOverride(
  externalId: string,
  patch: Record<string, unknown>,
  durationMs: number,
  reason: string,
): void {
  overrides.set(externalId, {
    expiresAt: Date.now() + durationMs,
    patch,
    reason,
  });
}

/** Return the active override for a device, or `null` if none/expired.
 *  Auto-purges expired entries as a side effect so the map doesn't
 *  grow unbounded across a long-lived instance. */
export function getOverride(externalId: string): StatusOverride | null {
  const row = overrides.get(externalId);
  if (!row) return null;
  if (row.expiresAt < Date.now()) {
    overrides.delete(externalId);
    return null;
  }
  return row;
}

export function clearOverride(externalId: string): void {
  overrides.delete(externalId);
}

/** For the /overrides debug endpoint — list every active override. */
export function activeOverrides(): Array<{
  externalId: string;
  expiresAt: number;
  reason: string;
  patch: Record<string, unknown>;
}> {
  const now = Date.now();
  const out: Array<{
    externalId: string;
    expiresAt: number;
    reason: string;
    patch: Record<string, unknown>;
  }> = [];
  for (const [externalId, row] of overrides.entries()) {
    if (row.expiresAt < now) {
      overrides.delete(externalId);
      continue;
    }
    out.push({
      externalId,
      expiresAt: row.expiresAt,
      reason: row.reason,
      patch: row.patch,
    });
  }
  return out;
}
