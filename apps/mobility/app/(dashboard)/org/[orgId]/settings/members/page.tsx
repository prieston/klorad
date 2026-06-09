import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { TeamClient } from "./TeamClient";

type Params = Promise<{ orgId: string }>;

export const metadata = { title: "Team" };

export default async function OrgTeamPage({
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
  return (
    <TeamClient
      orgId={orgId}
      orgName={org.name}
      currentUserId={session.user.id as string}
      yourRole={membership.role}
    />
  );
}
