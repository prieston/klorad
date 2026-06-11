import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SettingsClient } from "./SettingsClient";

type Params = Promise<{ orgId: string; projectId: string }>;

export const metadata = { title: "Settings" };

export default async function ProjectSettingsPage({
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
    select: {
      id: true,
      title: true,
      isPublished: true,
      isPublic: true,
    },
  });
  if (!project) notFound();

  return (
    <SettingsClient
      orgId={orgId}
      projectId={projectId}
      initial={{
        title: project.title,
        isPublished: project.isPublished,
        isPublic: project.isPublic,
      }}
    />
  );
}
