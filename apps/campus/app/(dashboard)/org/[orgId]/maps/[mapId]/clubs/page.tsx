import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { listClubsForAdmin } from "@/lib/clubs-db";
import { ClubsAdminClient } from "./ClubsAdminClient";

type Params = Promise<{ orgId: string; mapId: string }>;

/**
 * `/org/[orgId]/maps/[mapId]/clubs` — admin clubs authoring.
 *
 * Lists clubs (name asc) + an inline create form. Backed by the
 * `Club` model from Arc 4 of [[campus-consumer-pivot]].
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
    <div className="mx-auto max-w-[960px] px-6 py-10">
      <Link
        href={`/org/${orgId}/maps/${mapId}`}
        className="inline-flex items-center gap-1 text-xs text-text-tertiary transition-colors hover:text-text-primary"
      >
        <ChevronLeft size={14} strokeWidth={1.75} />
        Back to {project.title}
      </Link>

      <div className="mt-6">
        <h1 className="text-2xl font-semibold text-text-primary">Clubs</h1>
        <p className="mt-1 text-sm text-text-tertiary">
          Student societies, sport clubs, interest groups. The View
          button on the consumer site opens the club&apos;s external
          link — no login on the public site.
        </p>
      </div>

      <ClubsAdminClient mapId={mapId} initialClubs={clubs} />
    </div>
  );
}
