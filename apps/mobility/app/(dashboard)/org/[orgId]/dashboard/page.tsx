import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { OverviewClient } from "./OverviewClient";

type Params = Promise<{ orgId: string }>;

export const metadata = { title: "Operations overview" };

export default async function OrgOverviewPage({
  params,
}: {
  params: Params;
}) {
  const { orgId } = await params;
  const session = await auth();
  if (!session?.user?.id) notFound();

  const membership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: orgId,
        userId: session.user.id,
      },
    },
    select: { role: true },
  });
  if (!membership) notFound();

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true },
  });
  if (!org) notFound();

  return <OverviewClient orgId={orgId} orgName={org.name} />;
}
