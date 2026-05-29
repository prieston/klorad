import { NextResponse } from "next/server";
import { requireCampusAccess } from "@/lib/authz";
import { readCampusHealth } from "@/lib/campus-health";

type Params = Promise<{ mapId: string }>;

/**
 * `GET /api/maps/[mapId]/health` — returns the Campus Health snapshot
 * feeding the campus dashboard's checklist + KPI cards.
 *
 * One server hop replaces the 4 separate count queries the client
 * would otherwise make (news / events / clubs / dining), and keeps
 * raw row data on the server side — the dashboard only needs totals
 * and booleans.
 *
 * Gated behind `requireCampusAccess` since the snapshot reveals
 * unpublished state.
 */
export async function GET(_req: Request, { params }: { params: Params }) {
  const { mapId } = await params;
  const denied = await requireCampusAccess(mapId, "read");
  if (denied) return denied;

  const health = await readCampusHealth(mapId);
  if (!health) return new NextResponse(null, { status: 404 });
  return NextResponse.json(health);
}
