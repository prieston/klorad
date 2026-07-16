/**
 * PATCH /api/projects/[projectId]/alerts/[alertId]
 *   Body: `{ action: "ack" | "unack" | "close" | "reopen" }`.
 *   Mutates `acknowledgedAt` / `acknowledgedById` / `closedAt`
 *   accordingly. Requires project `write` — the alerts panel is
 *   operator-only.
 *
 * Kept as a single mutation surface (not a REST-purist collection of
 * micro-endpoints) because the operator UI toggles these two flags
 * from a single row of buttons.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/authz";

type Params = Promise<{ projectId: string; alertId: string }>;

const Body = z.object({
  action: z.enum(["ack", "unack", "close", "reopen"]),
});

export async function PATCH(
  req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { projectId, alertId } = await params;
  const denied = await requireProjectAccess(projectId, "write");
  if (denied) return denied;

  const session = await auth();
  const userId = session?.user?.id as string | undefined;

  const alert = await prisma.mobilityAlert.findFirst({
    where: { id: alertId, projectId },
    select: { id: true },
  });
  if (!alert) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const now = new Date();
  const patch =
    parsed.data.action === "ack"
      ? { acknowledgedAt: now, acknowledgedById: userId ?? null }
      : parsed.data.action === "unack"
        ? { acknowledgedAt: null, acknowledgedById: null }
        : parsed.data.action === "close"
          ? { closedAt: now }
          : { closedAt: null };

  const updated = await prisma.mobilityAlert.update({
    where: { id: alertId },
    data: patch,
    select: {
      id: true,
      acknowledgedAt: true,
      acknowledgedById: true,
      closedAt: true,
    },
  });
  return NextResponse.json(updated);
}
