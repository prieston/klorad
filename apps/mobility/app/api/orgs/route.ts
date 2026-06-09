/**
 * GET /api/orgs — list organisations the caller is a member of.
 * Used by the sidebar's OrganizationSwitcher.
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = await prisma.organizationMember.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    select: {
      organization: { select: { id: true, name: true, slug: true } },
    },
  });
  return NextResponse.json({
    organizations: rows.map((r) => r.organization),
  });
}
