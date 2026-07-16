/**
 * GET /api/projects/[projectId]/alerts
 * Operator alerts feed. Reads durable `MobilityAlert` rows opened by
 * the rule engine (`lib/mobility/alert-dispatch.openAlertAndDispatch`)
 * rather than deriving on the fly from device status.
 *
 * Query params:
 *   ?state=open (default) | acknowledged | closed | all
 *
 * v1 caps at 200 rows — plenty for a demo tenant. Future: pagination
 * once a real tenant outgrows a single-day span.
 *
 * The previous derived-from-status implementation moved to the
 * durable path when the rule engine landed; a periodic "device
 * offline for N minutes" sweeper (which would also open
 * `MobilityAlert` rows) is a follow-up arc.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/authz";

type Params = Promise<{ projectId: string }>;

type StateFilter = "open" | "acknowledged" | "closed" | "all";

export async function GET(
  req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { projectId } = await params;
  const denied = await requireProjectAccess(projectId, "read");
  if (denied) return denied;

  const url = new URL(req.url);
  const state = normaliseState(url.searchParams.get("state"));

  const rows = await prisma.mobilityAlert.findMany({
    where: {
      projectId,
      ...(state === "open"
        ? { closedAt: null, acknowledgedAt: null }
        : state === "acknowledged"
          ? { closedAt: null, NOT: { acknowledgedAt: null } }
          : state === "closed"
            ? { NOT: { closedAt: null } }
            : {}),
    },
    orderBy: { openedAt: "desc" },
    take: 200,
    select: {
      id: true,
      kind: true,
      message: true,
      openedAt: true,
      closedAt: true,
      acknowledgedAt: true,
      acknowledgedById: true,
      device: {
        select: {
          id: true,
          externalDeviceId: true,
          subsystem: true,
          name: true,
          customLabel: true,
          primaryRoad: true,
          crossRoad: true,
          direction: true,
          agency: true,
        },
      },
    },
  });

  // Fetch acknowledger display names in one round-trip.
  const ackIds = Array.from(
    new Set(rows.map((r) => r.acknowledgedById).filter((s): s is string => !!s)),
  );
  const users = ackIds.length
    ? await prisma.user.findMany({
        where: { id: { in: ackIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const userById = new Map(users.map((u) => [u.id, u]));

  return NextResponse.json({
    state,
    alerts: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      message: r.message,
      openedAt: r.openedAt.toISOString(),
      closedAt: r.closedAt?.toISOString() ?? null,
      acknowledgedAt: r.acknowledgedAt?.toISOString() ?? null,
      acknowledgedBy: r.acknowledgedById
        ? {
            id: r.acknowledgedById,
            name: userById.get(r.acknowledgedById)?.name ?? null,
            email: userById.get(r.acknowledgedById)?.email ?? null,
          }
        : null,
      device: r.device,
    })),
  });
}

function normaliseState(raw: string | null): StateFilter {
  if (raw === "acknowledged" || raw === "closed" || raw === "all") return raw;
  return "open";
}
