import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { getWorldStats } from "@/lib/mobility/world-events";
import { WorldEditor } from "./WorldEditor";

type Params = Promise<{
  orgId: string;
  projectId: string;
  worldId: string;
}>;

export const metadata = {
  title: "Edit world",
};

/**
 * `/org/[orgId]/projects/[projectId]/worlds/[worldId]` — deep editor
 * for one world. SSR fetches the world + its current device membership
 * + the full pool of curated devices for the project (so the picker
 * can render without an extra round-trip). The client owns the form
 * state + the save action.
 */
export default async function WorldEditorPage({ params }: { params: Params }) {
  const { orgId, projectId, worldId } = await params;
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

  const world = await prisma.mobilityWorld.findFirst({
    where: { id: worldId, projectId },
    include: {
      devices: { select: { deviceId: true } },
      _count: { select: { pushSubscriptions: true } },
    },
  });
  if (!world) notFound();

  // Eligible devices = anything the operator has already curated as
  // "included" in this project. Worlds carve a subset out of the
  // curated pool, not out of every raw sync row.
  const pool = await prisma.mobilityDevice.findMany({
    where: { projectId, included: true },
    orderBy: [{ subsystem: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      customLabel: true,
      subsystem: true,
      primaryRoad: true,
      crossRoad: true,
      lat: true,
      lng: true,
    },
  });

  const stats = await getWorldStats(world.id);

  return (
    <WorldEditor
      orgId={orgId}
      projectId={projectId}
      projectTitle={project.title}
      world={{
        id: world.id,
        slug: world.slug,
        name: world.name,
        description: world.description,
        visibility: world.visibility,
        isPublished: world.isPublished,
        publishedAt: world.publishedAt?.toISOString() ?? null,
        subscriberCount: world._count.pushSubscriptions,
        theme: (world.theme ?? {}) as Record<string, unknown>,
      }}
      initialDeviceIds={world.devices.map((d) => d.deviceId)}
      devicePool={pool.map((d) => ({
        id: d.id,
        name: d.customLabel ?? d.name,
        subsystem: d.subsystem,
        primaryRoad: d.primaryRoad,
        crossRoad: d.crossRoad,
        hasLocation: d.lat !== null && d.lng !== null,
      }))}
      stats={stats}
    />
  );
}
