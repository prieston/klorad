/**
 * `GET /api/demo/status` — snapshot of what the mock's scripted state
 * is currently doing (active incident? traffic ticker running? which
 * device overrides are still hot and for how long?). Powers the demo
 * control panel's "active" badges + countdown chips.
 *
 * Public to same-origin (the demo panel) so it can poll without a
 * login prompt; external CLIs still hit Basic auth. Same rule as the
 * `POST /api/demo/scenario/*` triggers.
 */
import { NextRequest, NextResponse } from "next/server";
import { isSameOriginRequest, requireBasicAuth } from "@/lib/auth";
import { getScenarioStatus } from "@/lib/scenarios";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    const denied = requireBasicAuth(request);
    if (denied) return denied;
  }
  return NextResponse.json(getScenarioStatus(), {
    // Never cache; the whole point is fresh state on every poll.
    headers: { "cache-control": "no-store" },
  });
}
