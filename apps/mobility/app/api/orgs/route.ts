/**
 * GET /api/orgs — list organisations the caller is a member of, filtered
 * to those that have Klorad Mobility enabled. The Klorad admin app
 * controls `Organization.apps`; Mobility surfaces only the
 * subset tagged with `"mobility"`. Personal orgs are excluded.
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const APP_KEY = "mobility";

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = await prisma.organizationMember.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    select: {
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          isPersonal: true,
          apps: true,
        },
      },
    },
  });
  const organizations = rows
    .filter((r) => {
      if (r.organization.isPersonal) return false;
      return (r.organization.apps ?? []).includes(APP_KEY);
    })
    .map((r) => ({
      id: r.organization.id,
      name: r.organization.name,
      slug: r.organization.slug,
    }));
  return NextResponse.json({ organizations });
}
