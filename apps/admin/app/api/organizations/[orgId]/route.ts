import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isGodUser } from "@/lib/config/godusers";
import { KLORAD_APPS, type KloradApp } from "@/app/dashboard/components/appsConfig";

interface RouteParams {
  params: Promise<{ orgId: string }>;
}

/** Single source of truth — adding a new entry to `appsConfig.ts`
 *  automatically widens both the UI dialog and the API allowlist. */
const KNOWN_APP_KEYS: ReadonlySet<KloradApp> = new Set(
  KLORAD_APPS.map((a) => a.key),
);

/**
 * PATCH: Update organization (currently only the `apps` tag list).
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isGodUser(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orgId } = await params;
  const body = (await request.json().catch(() => ({}))) as { apps?: unknown };

  if (!Array.isArray(body.apps)) {
    return NextResponse.json(
      { error: "apps must be an array of strings" },
      { status: 400 }
    );
  }

  const apps = Array.from(
    new Set(
      body.apps.filter(
        (v): v is KloradApp =>
          typeof v === "string" && KNOWN_APP_KEYS.has(v as KloradApp),
      ),
    ),
  );

  try {
    const organization = await prisma.organization.update({
      where: { id: orgId },
      data: { apps },
      select: { id: true, name: true },
    });
    return NextResponse.json({ organization: { ...organization, apps } });
  } catch (error) {
    console.error("[Admin Organizations API] PATCH error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Delete organization
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isGodUser(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orgId } = await params;

  try {
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    await prisma.organization.delete({
      where: { id: orgId },
    });

    return NextResponse.json({
      success: true,
      message: "Organization deleted successfully",
    });
  } catch (error) {
    console.error("[Admin Organizations API] Error deleting organization:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      { status: 500 }
    );
  }
}

