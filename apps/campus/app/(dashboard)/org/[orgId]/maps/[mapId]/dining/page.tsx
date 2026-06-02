import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { listDiningForProject } from "@/lib/dining-db";
import { DiningAdminClient } from "./DiningAdminClient";
import { PageHeader } from "@/app/(dashboard)/components/PageHeader";
import { OpenPublicAction } from "@/app/(dashboard)/components/OpenPublicAction";

type Params = Promise<{ orgId: string; mapId: string }>;

/**
 * `/org/[orgId]/maps/[mapId]/dining` — admin dining authoring under
 * the new backoffice IA.
 */
export default async function DiningAdminPage({
  params,
}: {
  params: Params;
}) {
  const { orgId, mapId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in");

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
    where: { id: mapId, organizationId: orgId },
    select: { id: true, title: true, sceneData: true },
  });
  if (!project) notFound();

  const indoorMapId =
    (project.sceneData as { indoorMapId?: string } | null)?.indoorMapId ??
    null;
  const locations = await listDiningForProject(mapId);

  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-8 md:px-10">
      <PageHeader
        eyebrow="Public surface"
        title="Dining"
        subtitle='Cafes and canteens. "Open now" is computed from weekly hours — no manual toggle.'
        actions={<OpenPublicAction href={`/campus/${mapId}/dining`} />}
      />

      <DiningAdminClient
        mapId={mapId}
        initialLocations={locations}
        indoorMapId={indoorMapId}
      />
    </div>
  );
}
