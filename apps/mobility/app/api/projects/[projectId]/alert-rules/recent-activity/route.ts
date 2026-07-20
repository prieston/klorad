/**
 * `GET /api/projects/[projectId]/alert-rules/recent-activity` — the
 * last ~50 webhook receipts for this project, most recent first.
 * Powers the Alert Rules "Recent webhook activity" panel.
 *
 * Read from an in-memory ring buffer; a Vercel cold start clears
 * history but that's fine for the live-debug loop this panel is
 * for. Read-only, no cache.
 *
 * Requires project `read`.
 */
import { NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/authz";
import { recentReceipts } from "@/lib/mobility/webhook-audit";

type Params = Promise<{ projectId: string }>;

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { projectId } = await params;
  const denied = await requireProjectAccess(projectId, "read");
  if (denied) return denied;

  return NextResponse.json(
    { receipts: recentReceipts(projectId) },
    { headers: { "cache-control": "no-store" } },
  );
}
