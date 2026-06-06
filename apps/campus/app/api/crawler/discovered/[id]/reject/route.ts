/**
 * POST /api/crawler/discovered/[id]/reject — soft-delete a pending
 * discovered item. The row stays in the table (so we can show "X
 * rejected" tallies later) but is invisible to the inbox.
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireCampusAccess } from "@/lib/authz";

type Params = Promise<{ id: string }>;

export async function POST(_req: Request, { params }: { params: Params }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const item = await prisma.discoveredItem.findUnique({
    where: { id },
    select: { id: true, projectId: true, status: true },
  });
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (item.status !== "pending") {
    return NextResponse.json(
      { error: "Item already reviewed" },
      { status: 409 },
    );
  }

  const denied = await requireCampusAccess(item.projectId, "write");
  if (denied) return denied;

  await prisma.discoveredItem.update({
    where: { id: item.id },
    data: {
      status: "rejected",
      reviewedById: session.user.id as string,
      reviewedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
