import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { WorldsClient } from "./WorldsClient";

type Params = Promise<{ orgId: string; projectId: string }>;

export const metadata = {
  title: "Worlds",
};

/**
 * `/org/[orgId]/projects/[projectId]/worlds` — the per-project worlds
 * console. Each row is a publishable, stakeholder-facing PWA carved
 * out of the project's curated devices. The client renders the list +
 * the "create new world" affordance; deep-edit (device picker + theme
 * + publish) lives at `./[worldId]`.
 */
export default async function WorldsPage({ params }: { params: Params }) {
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

  const worlds = await prisma.mobilityWorld.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      visibility: true,
      isPublished: true,
      publishedAt: true,
      updatedAt: true,
      _count: { select: { devices: true } },
    },
  });

  const initial = worlds.map((w) => ({
    id: w.id,
    slug: w.slug,
    name: w.name,
    description: w.description,
    visibility: w.visibility,
    isPublished: w.isPublished,
    publishedAt: w.publishedAt?.toISOString() ?? null,
    updatedAt: w.updatedAt.toISOString(),
    deviceCount: w._count.devices,
  }));

  return (
    <WorldsClient
      orgId={orgId}
      projectId={projectId}
      projectTitle={project.title}
      initialWorlds={initial}
    />
  );
}
