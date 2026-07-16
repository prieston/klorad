import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { TeamDetailClient } from "./TeamDetailClient";

type Params = Promise<{ orgId: string; teamId: string }>;

export const metadata = { title: "Team" };

export default async function TeamDetailPage({
  params,
}: {
  params: Params;
}) {
  const { orgId, teamId } = await params;
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
  const team = await prisma.team.findFirst({
    where: { id: teamId, organizationId: orgId },
    select: { id: true, name: true },
  });
  if (!team) notFound();
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true },
  });
  if (!org) notFound();

  return (
    <TeamDetailClient
      orgId={orgId}
      orgName={org.name}
      teamId={team.id}
      teamName={team.name}
      yourRole={membership.role}
    />
  );
}
