import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const APP_KEY = "heritage";

/**
 * `/org` — the org picker. Prefers a Heritage-enabled org so a curator who is
 * also a member of Campus-only orgs doesn't get bounced into a "not enabled"
 * gate. Falls back to the user's first membership so the gate can explain the
 * situation rather than 404'ing silently.
 */
export default async function OrgRootPage() {
  const session = await auth();
  if (!session?.user?.id) notFound();

  const heritageFirst = await prisma.organizationMember.findFirst({
    where: {
      userId: session.user.id,
      organization: { isPersonal: false, apps: { has: APP_KEY } },
    },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true },
  });
  if (heritageFirst) redirect(`/org/${heritageFirst.organizationId}`);

  const anyMembership = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true },
  });
  if (anyMembership) redirect(`/org/${anyMembership.organizationId}`);

  redirect("/");
}
