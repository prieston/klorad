import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasUserRoleInOrganization } from "@/lib/organizations";
import { prisma } from "@/lib/prisma";
import { serverEnv } from "@/lib/env/server";
import Stripe from "stripe";
import { getBaseUrl } from "@/lib/utils/url";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-11-17.clover",
});

interface RouteParams {
  params: Promise<{ orgId: string }>;
}

/**
 * POST: Create Stripe checkout session for plan upgrade
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const { orgId } = await params;

  try {
    const body = await request.json();
    const { planCode, billingInterval } = body;

    if (!planCode || !billingInterval) {
      return NextResponse.json(
        { error: "planCode and billingInterval are required" },
        { status: 400 }
      );
    }

    // Check if user has admin or owner role
    const canEdit =
      (await hasUserRoleInOrganization(userId, orgId, "admin")) ||
      (await hasUserRoleInOrganization(userId, orgId, "owner"));

    if (!canEdit) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Verify organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Get plan details
    const plan = await prisma.plan.findUnique({
      where: { code: planCode },
    });

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
      return NextResponse.json(
        { error: "Stripe price ID not configured for this plan. Please set STRIPE_PRO_PRICE_ID_MONTHLY environment variable, or configure it in the database." },
        { status: 400 }
      );
    }

    // Get or create Stripe customer
    let customerId = organization.stripeCustomerId;

    if (!customerId) {
      // Get user email for Stripe customer
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      });

      const customer = await stripe.customers.create({
        email: user?.email || undefined,
        name: user?.name || undefined,
        metadata: {
          organizationId: orgId,
        },
      });

      customerId = customer.id;

      // Update organization with Stripe customer ID
      await prisma.organization.update({
        where: { id: orgId },
        data: { stripeCustomerId: customerId },
      });
    }

    // Create checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${getBaseUrl(request)}/org/${orgId}/billing?success=true`,
      cancel_url: `${getBaseUrl(request)}/org/${orgId}/billing?canceled=true`,
      metadata: {
        organizationId: orgId,
        planCode: planCode,
        billingInterval: billingInterval,
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("[Checkout API] Error creating checkout session:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      { status: 500 }
    );
  }
}

