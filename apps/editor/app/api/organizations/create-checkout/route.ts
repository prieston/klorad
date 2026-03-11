import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { serverEnv } from "@/lib/env/server";
import Stripe from "stripe";
import { isGodUser } from "@/lib/config/godusers";
import { getBaseUrl } from "@/lib/utils/url";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-11-17.clover",
});

/**
 * POST: Create Stripe checkout session for new organization creation
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const body = await request.json();
    const { planCode, billingInterval, orgName, orgSlug } = body;

    if (!planCode || !billingInterval || !orgName || !orgSlug) {
      return NextResponse.json(
        {
          error: "planCode, billingInterval, orgName, and orgSlug are required",
        },
        { status: 400 }
      );
    }

    // Get plan details (or use defaults from env for pro plan)
    let plan = await prisma.plan.findUnique({
      where: { code: planCode },
    });

    // If plan not found in DB but it's pro and we have env vars, use defaults
    if (!plan && planCode === "pro") {
      plan = {
        code: "pro",
        name: "Organisation Workspace",
        monthlyPriceCents: 14900,
        yearlyPriceCents: 178800,
        stripeProductId: serverEnv.STRIPE_PRO_PRODUCT_ID || null,
        stripePriceIdMonthly: serverEnv.STRIPE_PRO_PRICE_ID_MONTHLY || null,
        stripePriceIdYearly: serverEnv.STRIPE_PRO_PRICE_ID_YEARLY || null,
      } as any;
    }

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    if (planCode === "enterprise") {
      return NextResponse.json(
        { error: "Please contact sales@klorad.com for Enterprise pricing" },
        { status: 400 }
      );
    }

    // Get Stripe price ID - only monthly is supported
    if (billingInterval !== "monthly") {
      return NextResponse.json(
        { error: "Only monthly billing is currently supported" },
        { status: 400 }
      );
    }

    // First try database, then fallback to environment variables
    let priceId = plan.stripePriceIdMonthly;

    // Fallback to environment variables if not in database
    if (!priceId && planCode === "pro") {
      priceId = serverEnv.STRIPE_PRO_PRICE_ID_MONTHLY || undefined;
    }

    if (!priceId) {
      console.error(
        `[Create Checkout API] Stripe price ID not configured for plan ${planCode}. Monthly: ${plan.stripePriceIdMonthly || serverEnv.STRIPE_PRO_PRICE_ID_MONTHLY || "not set"}`
      );
      return NextResponse.json(
        {
          error: `Stripe price ID not configured for this plan. Please set STRIPE_PRO_PRICE_ID_MONTHLY environment variable, or configure it in the database.`,
        },
        { status: 400 }
      );
    }

    // Validate slug format
    const slugRegex = /^[a-z0-9-_]+$/;
    if (!slugRegex.test(orgSlug)) {
      return NextResponse.json(
        {
          error:
            "Slug can only contain lowercase letters, numbers, hyphens, and underscores",
        },
        { status: 400 }
      );
    }

    // Check if slug is already taken
    const existingOrg = await prisma.organization.findUnique({
      where: { slug: orgSlug },
    });

    if (existingOrg) {
      return NextResponse.json(
        { error: "Slug is already taken" },
        { status: 400 }
      );
    }

    // Get user email for Stripe customer
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    // GOD USER HACK: Bypass billing for god users
    if (isGodUser(user?.email)) {
      // Create organization directly without payment
      const organization = await prisma.organization.create({
        data: {
          name: orgName.trim(),
          slug: orgSlug.trim(),
          isPersonal: false,
          planCode: planCode,
          // No Stripe IDs for god users
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          subscriptionStatus: "active", // Mark as active even without payment
        },
      });

      // Add user as owner
      await prisma.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId: userId,
          role: "owner",
        },
      });

      // Return success URL instead of Stripe checkout URL
      return NextResponse.json({
        url: `${getBaseUrl(request)}/org/${organization.id}/dashboard?org_created=true`,
        bypassed: true,
      });
    }

    // Regular flow: Create Stripe customer (organization will be created after payment)
    const customer = await stripe.customers.create({
      email: user?.email || undefined,
      name: user?.name || undefined,
      metadata: {
        userId: userId,
        orgName: orgName.trim(),
        orgSlug: orgSlug.trim(),
        planCode: planCode,
        billingInterval: billingInterval,
        isNewOrganization: "true",
      },
    });

    // Create checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customer.id,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${getBaseUrl(request)}/dashboard?org_created=true`,
      cancel_url: `${getBaseUrl(request)}/dashboard?org_canceled=true`,
      metadata: {
        userId: userId,
        orgName: orgName.trim(),
        orgSlug: orgSlug.trim(),
        planCode: planCode,
        billingInterval: billingInterval,
        isNewOrganization: "true",
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error(
      "[Create Checkout API] Error creating checkout session:",
      error
    );
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      { status: 500 }
    );
  }
}
