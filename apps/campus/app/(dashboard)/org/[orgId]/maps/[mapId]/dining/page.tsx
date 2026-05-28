import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { listDiningForProject } from "@/lib/dining-db";
import { DiningAdminClient } from "./DiningAdminClient";

type Params = Promise<{ orgId: string; mapId: string }>;

/**
 * `/org/[orgId]/maps/[mapId]/dining` — admin dining authoring.
 *
 * Smallest of the four content admins because dining rows hold
 * less variability — name + description + free-text hours + optional
 * menu link + optional cuisine.
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
    <div className="mx-auto max-w-[960px] px-6 py-10">
      <Link
        href={`/org/${orgId}/maps/${mapId}`}
        className="inline-flex items-center gap-1 text-xs text-text-tertiary transition-colors hover:text-text-primary"
      >
        <ChevronLeft size={14} strokeWidth={1.75} />
        Back to {project.title}
      </Link>

      <div className="mt-6">
        <h1 className="text-2xl font-semibold text-text-primary">
          Dining
        </h1>
        <p className="mt-1 text-sm text-text-tertiary">
          Cafeterias, cafes, food courts. Listed alphabetically on
          the public dining page.
        </p>
      </div>

      <DiningAdminClient
        mapId={mapId}
        initialLocations={locations}
        indoorMapId={indoorMapId}
      />
    </div>
  );
}
