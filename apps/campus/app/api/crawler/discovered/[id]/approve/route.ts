/**
 * POST /api/crawler/discovered/[id]/approve — turn a pending
 * DiscoveredItem into a real NewsPost / EventPost. Audit + cache bust
 * mirror the manual-author flow so the new row behaves identically
 * downstream.
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireCampusAccess } from "@/lib/authz";
import { recordAudit } from "@/lib/audit";
import { revalidateTag } from "next/cache";
import { publicCampusTag } from "@/lib/public-campus";
import { approveAsEvent, approveAsNews } from "@/lib/crawler/approve";
import type {
  CampusEventExtraction,
  CampusNewsExtraction,
} from "@/lib/crawler/profile";

type Params = Promise<{ id: string }>;

export async function POST(_req: Request, { params }: { params: Params }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const item = await prisma.discoveredItem.findUnique({
    where: { id },
    select: {
      id: true,
      projectId: true,
      sourceUrl: true,
      contentType: true,
      extracted: true,
      status: true,
      project: { select: { organizationId: true } },
    },
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

  const ctx = {
    projectId: item.projectId,
    organizationId: item.project.organizationId,
    sourceUrl: item.sourceUrl,
  };

  let published: { id: string };
  let entityType: "NEWS_POST" | "EVENT_POST";
  try {
    if (item.contentType === "news") {
      published = await approveAsNews(
        item.extracted as unknown as CampusNewsExtraction,
        ctx,
      );
      entityType = "NEWS_POST";
    } else if (item.contentType === "event") {
      published = await approveAsEvent(
        item.extracted as unknown as CampusEventExtraction,
        ctx,
      );
      entityType = "EVENT_POST";
    } else {
      return NextResponse.json(
        { error: `Unknown contentType: ${item.contentType}` },
        { status: 400 },
      );
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Approval failed" },
      { status: 422 },
    );
  }

  await prisma.discoveredItem.update({
    where: { id: item.id },
    data: {
      status: "approved",
      reviewedById: session.user.id as string,
      reviewedAt: new Date(),
      publishedAs: published.id,
    },
  });

  revalidateTag(publicCampusTag(item.projectId));

  await recordAudit({
    organizationId: item.project.organizationId,
    projectId: item.projectId,
    actorId: session.user.id as string,
    entityType,
    entityId: published.id,
    action: "CREATED",
    message: `Approved from crawler (${item.sourceUrl})`,
    metadata: { discoveredItemId: item.id, sourceUrl: item.sourceUrl },
  });

  return NextResponse.json({ id: published.id, entityType });
}
