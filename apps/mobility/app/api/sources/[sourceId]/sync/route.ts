/**
 * POST /api/sources/[sourceId]/sync
 *
 * Schedules a sync. The response returns immediately with
 * `{ started: true }`; the actual work runs in the post-response
 * budget via Next.js `after()`. The dashboard polls the source list
 * (which now carries `syncStatus` + `syncProgress`) to render a
 * live progress card.
 *
 * Vercel budgets for `after()`:
 *   • Hobby: ~60s post-response
 *   • Pro:   ~300s post-response
 * Beyond that, the runner doesn't have time to finish on Vercel —
 * the durable-jobs follow-up arc graduates this to Inngest.
 */
import { NextResponse } from "next/server";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/authz";
import { markSyncStarted, runSync } from "@/lib/mobility/sync";

type Params = Promise<{ sourceId: string }>;

/** Belt-and-suspenders cap — the inline kickoff itself is tiny.
 *  `after()` gets its own platform budget. */
export const maxDuration = 60;

export async function POST(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { sourceId } = await params;
  const row = await prisma.mobilityDataSource.findUnique({
    where: { id: sourceId },
    select: { projectId: true, enabled: true, syncStatus: true },
  });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!row.enabled) {
    return NextResponse.json(
      { error: "Source is disabled" },
      { status: 409 },
    );
  }
  if (row.syncStatus === "running") {
    // Idempotent — don't kick off a second sync on top.
    return NextResponse.json({ started: false, reason: "already running" });
  }
  const denied = await requireProjectAccess(row.projectId, "write");
  if (denied) return denied;

  // Mark the source row as `running` synchronously so the client's
  // optimistic UI matches the persisted state immediately.
  await markSyncStarted(sourceId);

  // Kick off the real work. `after()` keeps the runtime alive for it
  // after the response goes out.
  after(async () => {
    try {
      await runSync(sourceId);
    } catch {
      // `runSync` already writes the failure state to the row; the
      // catch here keeps an unexpected throw from poisoning the
      // runtime.
    }
  });

  return NextResponse.json({ started: true });
}
