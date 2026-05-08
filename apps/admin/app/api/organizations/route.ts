import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isGodUser } from "@/lib/config/godusers";

/**
 * GET: List all organizations
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isGodUser(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // [ADMIN_PRISMA] Using _count to avoid N+1 queries - counts computed in single query
    const organizations = await prisma.organization.findMany({
      include: {
        _count: {
          select: {
            members: true,
            projects: true,
            assets: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ organizations });
  } catch (error) {
    console.error("[Admin Organizations API] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST: Create a new organization
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isGodUser(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get user ID from database
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const userId = user.id;

  try {
    const body = await request.json();
    const { name, slug, apps } = body as { name?: string; slug?: string; apps?: unknown };
    const KNOWN_APPS = ["editor", "campus", "culture"] as const;
    type KnownApp = (typeof KNOWN_APPS)[number];
    const normalizedApps: KnownApp[] = Array.isArray(apps)
      ? Array.from(
          new Set(
            apps.filter((v): v is KnownApp =>
              typeof v === "string" &&
              (KNOWN_APPS as readonly string[]).includes(v)
            )
          )
        )
      : [];

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Organization name is required" },
        { status: 400 }
      );
    }

    let finalSlug = slug || name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-");
    finalSlug = finalSlug.replace(/^-+|-+$/g, "");

    if (!finalSlug || finalSlug.length === 0) {
      return NextResponse.json(
        { error: "Invalid organization name" },
        { status: 400 }
      );
    }

    const slugRegex = /^[a-z0-9-_]+$/;
    if (!slugRegex.test(finalSlug)) {
      return NextResponse.json(
        {
          error:
            "Slug can only contain lowercase letters, numbers, hyphens, and underscores",
        },
        { status: 400 }
      );
    }

    const existingOrg = await prisma.organization.findUnique({
      where: { slug: finalSlug },
    });

    if (existingOrg) {
      return NextResponse.json({ error: "Slug is already taken" }, { status: 400 });
    }

    // Ensure all plans exist (required by foreign key constraint)
    const plansToSeed = [
      {
        code: "free",
        name: "Solo Workspace",
        monthlyPriceCents: 0,
        yearlyPriceCents: 0,
        includedStorageGb: 1,
        includedBandwidthGbPerMonth: 5,
        includedSeats: 0,
        includedProcessingJobsPerMonth: 0,
        includedProjects: 10,
        includedPublishedProjects: 10,
        includedPrivateShares: 1,
        includedCesiumIntegrations: 1,
        cesiumUploadLimitGb: 5,
        overageStoragePricePerGbCents: 0,
        overageBandwidthPricePerGbCents: 0,
        overageSeatPricePerMonthCents: 0,
        stripeProductId: null,
        stripePriceIdMonthly: null,
        stripePriceIdYearly: null,
      },
      {
        code: "pro",
        name: "Organisation Workspace",
        monthlyPriceCents: 14900,
        yearlyPriceCents: 178800,
        includedStorageGb: 100,
        includedBandwidthGbPerMonth: 250,
        includedSeats: 9999,
        includedProcessingJobsPerMonth: 20,
        includedProjects: null,
        includedPublishedProjects: null,
        includedPrivateShares: null,
        includedCesiumIntegrations: null,
        cesiumUploadLimitGb: null,
        overageStoragePricePerGbCents: 0,
        overageBandwidthPricePerGbCents: 0,
        overageSeatPricePerMonthCents: 0,
        stripeProductId: null,
        stripePriceIdMonthly: null,
        stripePriceIdYearly: null,
      },
      {
        code: "enterprise",
        name: "Enterprise",
        monthlyPriceCents: null,
        yearlyPriceCents: null,
        includedStorageGb: 9999,
        includedBandwidthGbPerMonth: 9999,
        includedSeats: 9999,
        includedProcessingJobsPerMonth: 9999,
        includedProjects: null,
        includedPublishedProjects: null,
        includedPrivateShares: null,
        includedCesiumIntegrations: null,
        cesiumUploadLimitGb: null,
        overageStoragePricePerGbCents: 0,
        overageBandwidthPricePerGbCents: 0,
        overageSeatPricePerMonthCents: 0,
        stripeProductId: null,
        stripePriceIdMonthly: null,
        stripePriceIdYearly: null,
      },
    ];

    // Seed all plans if they don't exist
    for (const planData of plansToSeed) {
      const existingPlan = await prisma.plan.findUnique({
        where: { code: planData.code },
      });

      if (!existingPlan) {
        await prisma.plan.create({
          data: planData,
        });
      }
    }

    const organization = await prisma.organization.create({
      data: {
        name: name.trim(),
        slug: finalSlug,
        isPersonal: false,
        planCode: "free", // Explicitly set to ensure foreign key constraint is satisfied
        apps: normalizedApps,
      },
    });

    await prisma.organizationMember.create({
      data: {
        organizationId: organization.id,
        userId,
        role: "owner",
      },
    });

    return NextResponse.json({ organization });
  } catch (error) {
    console.error("[Admin Organizations API] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      { status: 500 }
    );
  }
}

