import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const members = await prisma.organizationMember.findMany({
    where: { userId: session.user.id as string },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });

  const organizations = members
    .filter((m) => {
      if (m.organization.isPersonal) return false;
      return (m.organization.apps ?? []).includes("campus");
    })
    .map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug ?? null,
      isPersonal: m.organization.isPersonal ?? false,
      userRole: m.role,
    }));

  return NextResponse.json({ organizations });
}
