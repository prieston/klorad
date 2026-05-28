/**
 * In-memory rate limiter for /api/assistant.
 *
 * The assistant is public (no auth, no token) and calls a paid LLM,
 * so an unbounded endpoint is a liability. This module is the
 * cheapest defence — per-IP token bucket, fixed window — and is
 * good enough for one-instance deployments and the first wave of
 * traffic. Multi-instance prod wants Redis (or Upstash). The seam
 * for that swap is `checkRateLimit`; nothing else has to change.
 */

const RATE_LIMIT = 30;
const WINDOW_MS = 60_000;
/** Hard cap so a one-process memory leak isn't a thing. */
const MAX_BUCKETS = 10_000;

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Best-effort caller-ip extraction from the request headers. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

export interface RateCheck {
  ok: boolean;
  remaining: number;
  resetIn: number;
}

/** Returns whether the IP may proceed, plus headers-friendly metadata. */
export function checkRateLimit(ip: string): RateCheck {
  const now = Date.now();

  // Garbage-collect expired buckets when the table grows large.
  if (buckets.size > MAX_BUCKETS) {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt < now) buckets.delete(key);
    }
  }

  const bucket = buckets.get(ip);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return {
      ok: true,
      remaining: RATE_LIMIT - 1,
      resetIn: WINDOW_MS,
    };
  }
  if (bucket.count >= RATE_LIMIT) {
    return {
      ok: false,
      remaining: 0,
      resetIn: Math.max(0, bucket.resetAt - now),
    };
  }
  bucket.count += 1;
  return {
    ok: true,
    remaining: RATE_LIMIT - bucket.count,
    resetIn: Math.max(0, bucket.resetAt - now),
  };
}
