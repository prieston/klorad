/**
 * GET /api/demo/overrides
 *   List the currently-active status overrides. Debug affordance for
 *   the demo picker + operator troubleshooting — lets someone confirm
 *   that a scenario POST actually took effect on the instance handling
 *   /status calls.
 */
import { NextRequest, NextResponse } from "next/server";
import { isSameOriginRequest, requireBasicAuth } from "@/lib/auth";
import { activeOverrides } from "@/lib/overrides";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    const denied = requireBasicAuth(request);
    if (denied) return denied;
  }
  const now = Date.now();
  const overrides = await activeOverrides();
  return NextResponse.json({
    now,
    overrides: overrides.map((o) => ({
      ...o,
      expiresInMs: Math.max(0, o.expiresAt - now),
    })),
  });
}
