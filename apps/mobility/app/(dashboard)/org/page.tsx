import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * `/org` — the org picker. v1 redirects to the user's first
 * membership; a real picker UI lands when a tenant has more than
 * one org and wants to switch (Campus uses OrganizationSwitcher
 * from @klorad/ui — we can lift it here later).
 */
export default async function OrgRootPage() {
  const session = await auth();
  if (!session?.user?.id) notFound();

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true },
  });
  if (!membership) {
    // No org yet — drop them on the landing page with a friendlier
    // story than a 404. Onboarding for org-create lands in a follow-up.
    redirect("/");
  }
  redirect(`/org/${membership.organizationId}`);
}
