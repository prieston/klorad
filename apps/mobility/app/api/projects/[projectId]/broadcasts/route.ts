/**
 * GET  /api/projects/[projectId]/broadcasts
 *   History feed + the project's current subscriber count.
 * POST /api/projects/[projectId]/broadcasts
 *   Create a broadcast. v1 persists the row but doesn't push yet —
 *   web-push delivery + VAPID wiring lands with the Mobility public
 *   PWA surface in a follow-up arc. The row is what shows up in
 *   the history feed and lets a future delivery worker pick it up.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireProjectAccess } from "@/lib/authz";

type Params = Promise<{ projectId: string }>;

const Body = z.object({
  title: z.string().min(1).max(80),
  body: z.string().min(1).max(280),
  /** Path to deep-link the recipient to, e.g. `/m/<projectId>?focus=24432`. */
  targetPath: z.string().max(280).nullable().optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { projectId } = await params;
  const denied = await requireProjectAccess(projectId, "read");
  if (denied) return denied;

  const [broadcasts, subscriberCount] = await Promise.all([
    prisma.broadcast.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        title: true,
        body: true,
        targetPath: true,
        attempted: true,
        delivered: true,
        pruned: true,
        opened: true,
        createdAt: true,
        sender: { select: { name: true, email: true } },
      },
    }),
    prisma.pushSubscription.count({ where: { projectId } }),
  ]);

  return NextResponse.json({
    broadcasts: broadcasts.map((b) => ({
      id: b.id,
      title: b.title,
      body: b.body,
      targetPath: b.targetPath,
      attempted: b.attempted,
      delivered: b.delivered,
      pruned: b.pruned,
      opened: b.opened,
      createdAt: b.createdAt.toISOString(),
      sender: b.sender?.name ?? b.sender?.email ?? null,
    })),
    subscriberCount,
  });
}

export async function POST(
  req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { projectId } = await params;
  const denied = await requireProjectAccess(projectId, "write");
  if (denied) return denied;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  const subscriberCount = await prisma.pushSubscription.count({
    where: { projectId },
  });

  const created = await prisma.broadcast.create({
    data: {
      projectId,
      title: parsed.data.title.trim(),
      body: parsed.data.body.trim(),
      targetPath: parsed.data.targetPath?.trim() || null,
      senderId: session.user.id as string,
      // v1: persist with `attempted` = current subscriber count so the
      // history reflects intent even though no notifications go out yet.
      attempted: subscriberCount,
      delivered: 0,
      pruned: 0,
      opened: 0,
    },
    select: { id: true },
  });
  return NextResponse.json({ id: created.id, attempted: subscriberCount });
}
