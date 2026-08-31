/**
 * POST /api/internal/ingest/drain — run queued ingest jobs.
 *
 * Not part of the tenant API surface: this is the operational endpoint a cron
 * schedule calls. Uploads process inline, so on a healthy day this finds
 * nothing to do. It earns its place on the days that are not healthy.
 */
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { serverEnv, features } from "@/lib/env";
import { drainIngestQueue } from "@/lib/heritage/pipeline/drain";

export const dynamic = "force-dynamic";
/** Header reads over a handful of jobs. Generous, but a cold start plus five
 *  ranged reads against object storage should never be squeezed. */
export const maxDuration = 300;

function authorised(req: Request): boolean {
  const secret = serverEnv.HERITAGE_INGEST_SECRET ?? serverEnv.CRON_SECRET;
  if (!secret) return false;

  const header = req.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7) : "";

  // Compare over fixed-length digests so the check does not leak the secret's
  // length, which a raw `timingSafeEqual` on the inputs would do by throwing
  // on a mismatch before comparing anything.
  const a = Buffer.from(presented.padEnd(64, "\0").slice(0, 64));
  const b = Buffer.from(secret.padEnd(64, "\0").slice(0, 64));
  return timingSafeEqual(a, b) && presented.length === secret.length;
}

export async function POST(req: Request): Promise<NextResponse> {
  if (!features.ingestWorker) {
    return NextResponse.json(
      {
        error:
          "No ingest secret is configured, so this endpoint is disabled. Set HERITAGE_INGEST_SECRET (or CRON_SECRET) to enable it.",
      },
      { status: 503 },
    );
  }
  if (!authorised(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const requested = Number(url.searchParams.get("limit") ?? "5");
  const limit = Number.isFinite(requested) ? Math.min(Math.max(1, requested), 25) : 5;

  const summary = await drainIngestQueue(limit);
  return NextResponse.json(summary);
}

/** Vercel Cron issues GET. Same work, same authentication. */
export async function GET(req: Request): Promise<NextResponse> {
  return POST(req);
}
