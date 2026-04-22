import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isGodUser } from "@/lib/config/godusers";

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isGodUser(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const section = searchParams.get("section") || "overview";

  try {
    if (section === "organizations") {
      // [ADMIN_PRISMA] Parallelize organization statistics queries
      const [personalOrgs, teamOrgs, allOrganizations] = await Promise.all([
        prisma.organization.count({
          where: { isPersonal: true },
        }),
        prisma.organization.count({
          where: { isPersonal: false },
        }),
        prisma.organization.findMany({
          select: {
            id: true,
            name: true,
            slug: true,
            isPersonal: true,
            planCode: true,
            subscriptionStatus: true,
            createdAt: true,
            apps: true,
            _count: {
              select: {
                members: true,
                projects: true,
                assets: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        }),
      ]);

      // Calculate byPlan stats from the fetched organizations
      const orgsByPlanMap = new Map<string, number>();
      allOrganizations.forEach((org) => {
        const count = orgsByPlanMap.get(org.planCode) || 0;
        orgsByPlanMap.set(org.planCode, count + 1);
      });
      const byPlan = Array.from(orgsByPlanMap.entries()).map(([planCode, count]) => ({
        planCode,
        count,
      }));

      return NextResponse.json({
        organizations: {
          total: personalOrgs + teamOrgs,
          personal: personalOrgs,
          team: teamOrgs,
          byPlan,
          all: allOrganizations.map((org) => ({
            id: org.id,
            name: org.name,
            slug: org.slug,
            isPersonal: org.isPersonal,
            planCode: org.planCode,
            subscriptionStatus: org.subscriptionStatus,
            apps: org.apps ?? [],
            memberCount: org._count.members,
            projectCount: org._count.projects,
            assetCount: org._count.assets,
            createdAt: org.createdAt,
          })),
        },
      });
    }

    if (section === "users") {
      const totalUsers = await prisma.user.count();

      // [ADMIN_PRISMA] Get all users with details
      const allUsers = await prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          _count: {
            select: {
              organizationMembers: true,
              activities: true,
            },
          },
        },
        orderBy: { id: "desc" },
      });

      return NextResponse.json({
        users: {
          total: totalUsers,
          all: allUsers.map((user) => ({
            id: user.id,
            name: user.name,
            email: user.email,
            emailVerified: user.emailVerified,
            organizationCount: user._count.organizationMembers,
            activityCount: user._count.activities,
          })),
        },
      });
    }

    // Default: Overview (section === "overview")
    // [ADMIN_PRISMA] Get all counts in parallel for efficiency
    const [
      totalUsers,
      totalOrganizations,
      totalProjects,
      totalAssets,
      totalActivities,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.organization.count(),
      prisma.project.count(),
      prisma.asset.count(),
      prisma.activity.count(),
    ]);

    // [ADMIN_PRISMA] CRITICAL FIX: Use SQL aggregation instead of fetching all assets
    const storageResult = await prisma.$queryRaw<[{ sum: bigint | null }]>`
      SELECT COALESCE(SUM("fileSize"), 0) as sum FROM "Asset"
    `;
    const totalStorageBytes = Number(storageResult[0].sum || BigInt(0));
    const totalStorageGB = totalStorageBytes / (1024 * 1024 * 1024);

    return NextResponse.json({
      overview: {
        totalUsers,
        totalOrganizations,
        totalProjects,
        totalAssets,
        totalActivities,
        totalStorageGB,
      },
    });
  } catch (error) {
    console.error("[Admin Stats API] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      { status: 500 }
    );
  }
}
