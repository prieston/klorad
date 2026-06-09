import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { OrgClient } from "./OrgClient";

type Params = Promise<{ orgId: string }>;

export const metadata = { title: "Projects" };

/**
 * `/org/[orgId]` — the org dashboard. Lists Mobility-shaped
 * Projects (engine=mapbox) under this org and hosts the "Create a
 * new project" form. Server-side membership check; the client
 * component owns the list + create flow + per-row navigation.
 */
export default async function OrgDashboardPage({
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

  // Mobility-shaped tenant filter. Campus projects (engine=three)
  // stay out of the picker; Mobility only surfaces engine=mapbox.
  // The create form below always uses mapbox.
  const projects = await prisma.project.findMany({
    where: { organizationId: orgId, engine: "mapbox" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      isPublished: true,
      isPublic: true,
      createdAt: true,
      _count: {
        select: {
          mobilityDataSources: true,
          mobilityDevices: true,
        },
      },
    },
  });

  return (
    <OrgClient
      orgId={orgId}
      orgName={org.name}
      initialProjects={projects.map((p) => ({
        id: p.id,
        title: p.title,
        isPublished: p.isPublished,
        isPublic: p.isPublic,
        createdAt: p.createdAt.toISOString(),
        sourceCount: p._count.mobilityDataSources,
        deviceCount: p._count.mobilityDevices,
      }))}
    />
  );
}
