import { NextResponse } from "next/server";
import { requireCampusAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ mapId: string }>;

/**
 * `GET /api/maps/[mapId]/push-stats` — push-notification subscriber
 * count for the Reach screen's "Subscribers" card. Just the headline
 * total for now; broadcast history with CTR / opt-in % over time is
 * a follow-up that needs a `Broadcast` model.
 *
 * Gated by `requireCampusAccess(mapId, "read")` — only people who
 * can author the campus see the subscriber count.
 */
export async function GET(_req: Request, { params }: { params: Params }) {
  const { mapId } = await params;
  const denied = await requireCampusAccess(mapId, "read");
  if (denied) return denied;

  try {
    const subscribers = await prisma.pushSubscription.count({
      where: { projectId: mapId },
    });
    return NextResponse.json({ subscribers });
  } catch (err) {
    console.error("[push-stats]", err);
    return NextResponse.json(
      { subscribers: 0, error: "stats unavailable" },
      { status: 200 },
    );
  }
}
