import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { GeneralClient } from "./GeneralClient";

type Params = Promise<{ orgId: string }>;

export const metadata = { title: "Organisation settings" };

export default async function OrgGeneralSettingsPage({
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
    select: { id: true, name: true, slug: true, planCode: true, createdAt: true },
  });
  if (!org) notFound();
  const projectCount = await prisma.project.count({
    where: { organizationId: orgId, engine: "mapbox" },
  });
  return (
    <GeneralClient
      orgId={orgId}
      yourRole={membership.role}
      initial={{
        name: org.name,
        slug: org.slug,
        planCode: org.planCode,
        createdAt: org.createdAt.toISOString(),
      }}
      projectCount={projectCount}
    />
  );
}
