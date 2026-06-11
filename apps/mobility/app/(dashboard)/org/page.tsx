import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const APP_KEY = "mobility";

/**
 * `/org` — the org picker. Prefers a Mobility-enabled org so a user
 * who is also a member of Campus-only orgs doesn't get bounced into
 * a "not enabled" gate. Falls back to the user's first membership so
 * the gate can explain the situation (rather than 404'ing silently).
 */
export default async function OrgRootPage() {
  const session = await auth();
  if (!session?.user?.id) notFound();

  // First pass: any org with mobility in `apps`.
  const mobilityFirst = await prisma.organizationMember.findFirst({
    where: {
      userId: session.user.id,
      organization: {
        isPersonal: false,
        apps: { has: APP_KEY },
      },
    },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true },
  });
  if (mobilityFirst) redirect(`/org/${mobilityFirst.organizationId}`);

  // Fallback: any membership. The `[orgId]/layout` gate will explain.
  const anyMembership = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true },
  });
  if (anyMembership) redirect(`/org/${anyMembership.organizationId}`);

  // No memberships at all → home page handles the friendly fallback.
  redirect("/");
}
