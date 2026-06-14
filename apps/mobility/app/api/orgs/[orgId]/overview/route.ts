/**
 * GET /api/orgs/[orgId]/overview
 * Aggregated counters for the org dashboard hero. Counts only what
 * the org can see (its own projects) — no cross-tenant peek.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgAccess } from "@/lib/authz";

type Params = Promise<{ orgId: string }>;

export async function GET(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { orgId } = await params;
  const denied = await requireOrgAccess(orgId, "read");
  if (denied) return denied;

  // Mobility-shaped projects only.
  const projectIds = (
    await prisma.project.findMany({
      where: { organizationId: orgId, engine: "mapbox" },
      select: { id: true },
    })
  ).map((p) => p.id);

  const projectScope = { in: projectIds };
  const [
    projectCount,
    publishedCount,
    sourceCount,
    deviceCount,
    publicCount,
    needsReviewCount,
    openAlertCount,
    recentSyncs,
  ] = await Promise.all([
    projectIds.length,
    prisma.project.count({
      where: { id: projectScope, isPublished: true },
    }),
    prisma.mobilityDataSource.count({ where: { projectId: projectScope } }),
    prisma.mobilityDevice.count({ where: { projectId: projectScope } }),
    prisma.mobilityDevice.count({
      where: { projectId: projectScope, isPublic: true },
    }),
    prisma.mobilityDevice.count({
      where: { projectId: projectScope, needsReview: true },
    }),
    prisma.mobilityAlert.count({
      where: { projectId: projectScope, closedAt: null },
    }),
    prisma.mobilityDataSource.findMany({
      where: {
        projectId: projectScope,
        lastSyncedAt: { not: null },
      },
      orderBy: { lastSyncedAt: "desc" },
      take: 5,
      select: {
        id: true,
        label: true,
        connectorId: true,
        lastSyncedAt: true,
        lastError: true,
        project: { select: { id: true, title: true } },
      },
    }),
  ]);

  return NextResponse.json({
    counters: {
      projectCount,
      publishedCount,
      sourceCount,
      deviceCount,
      publicCount,
      needsReviewCount,
      openAlertCount,
    },
    recentSyncs: recentSyncs.map((s) => ({
      id: s.id,
      label: s.label,
      connectorId: s.connectorId,
      lastSyncedAt: s.lastSyncedAt?.toISOString() ?? null,
      lastError: s.lastError,
      project: s.project,
    })),
  });
}
