import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { MembersClient } from "./MembersClient";

type Params = Promise<{ orgId: string; projectId: string }>;

export const metadata = { title: "Members" };

export default async function ProjectMembersPage({
  params,
}: {
  params: Params;
}) {
  const { orgId, projectId } = await params;
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
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: orgId },
    select: { id: true, title: true },
  });
  if (!project) notFound();
  return (
    <MembersClient
      orgId={orgId}
      projectId={projectId}
      projectTitle={project.title}
      currentUserId={session.user.id as string}
      yourOrgRole={membership.role}
    />
  );
}
