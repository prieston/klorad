import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { envValidationSkipped, features } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * `GET /api/health` — public uptime + integrations probe.
 *
 * Returns a JSON snapshot of:
 *  - DB reachability (real `SELECT 1`, not a Prisma type check)
 *  - which optional features are configured (booleans only — never
 *    secrets or sample values)
 *  - the Vercel commit + region (handy when triaging "is the new
 *    deploy actually serving traffic?")
 *
 * Used by:
 *  - external uptime monitors (Better Uptime, Pingdom, etc.)
 *  - the buyer-demo check: a quick "is everything wired" glance
 *    before opening the public viewer
 *  - the rector-facing settings screen (future) to tell them why
 *    push or AI chat isn't lit on their deploy
 *
 * Returns HTTP 200 when "healthy" (DB reachable), 503 when degraded
 * — uptime monitors treat 5xx as down even when the JSON body is
 * fine, so don't change this without checking what's polling.
 */
export async function GET() {
  const startedAt = Date.now();

  let dbOk = false;
  let dbError: string | undefined;
  try {
    // `$queryRaw` forces a real round-trip — `prisma.user.findFirst`
    // would happily return cached metadata without reaching the DB.
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch (err) {
    dbError = err instanceof Error ? err.message : "DB query failed";
  }

  const dbLatencyMs = Date.now() - startedAt;

  const body = {
    ok: dbOk,
    timestamp: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    region: process.env.VERCEL_REGION ?? "local",
    envValidationSkipped,
    db: {
      ok: dbOk,
      latencyMs: dbLatencyMs,
      ...(dbError ? { error: dbError } : {}),
    },
    features,
  };

  return NextResponse.json(body, { status: dbOk ? 200 : 503 });
}
