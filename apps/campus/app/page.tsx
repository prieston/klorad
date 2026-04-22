import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export default async function RootPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const memberships = await prisma.organizationMember.findMany({
    where: { userId: session.user.id as string },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });

  const campusOrg = memberships.find(
    (m) => !m.organization.isPersonal && (m.organization.apps ?? []).includes("campus")
  );
  if (campusOrg) redirect(`/org/${campusOrg.organization.id}/dashboard`);

  redirect("/onboarding");
}
