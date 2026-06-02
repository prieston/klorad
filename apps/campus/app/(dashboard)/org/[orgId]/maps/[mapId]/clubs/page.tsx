import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { listClubsForAdmin } from "@/lib/clubs-db";
import { ClubsAdminClient } from "./ClubsAdminClient";
import { PageHeader } from "@/app/(dashboard)/components/PageHeader";
import { OpenPublicAction } from "@/app/(dashboard)/components/OpenPublicAction";

type Params = Promise<{ orgId: string; mapId: string }>;

/**
 * `/org/[orgId]/maps/[mapId]/clubs` — admin clubs authoring under
 * the new backoffice IA.
 */
export default async function ClubsAdminPage({
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
    select: { id: true, title: true },
  });
  if (!project) notFound();

  const clubs = await listClubsForAdmin(mapId);

  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-8 md:px-10">
      <PageHeader
        eyebrow="Public surface"
        title="Clubs"
        subtitle="Student societies, ranked by weight. Featured clubs appear on the home rail."
        actions={<OpenPublicAction href={`/campus/${mapId}/clubs`} />}
      />

      <ClubsAdminClient mapId={mapId} initialClubs={clubs} />
    </div>
  );
}
