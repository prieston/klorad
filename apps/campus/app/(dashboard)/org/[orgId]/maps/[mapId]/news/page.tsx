import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { listNewsForAdmin } from "@/lib/news";
import { NewsAdminClient } from "./NewsAdminClient";

type Params = Promise<{ orgId: string; mapId: string }>;

/**
 * `/org/[orgId]/maps/[mapId]/news` — the new news authoring surface.
 *
 * Lists news posts on this campus + an inline create form. Backed by
 * the `NewsPost` model added in Arc 2 of [[campus-consumer-pivot]].
 * The legacy tab in `CampusProfileClient` (`NewsTab`) is untouched —
 * existing bilingual posts in `sceneData.posts` keep their editor.
 */
export default async function NewsAdminPage({
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

  const posts = await listNewsForAdmin(mapId);

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
        <h1 className="text-2xl font-semibold text-text-primary">News</h1>
        <p className="mt-1 text-sm text-text-tertiary">
          Geospatial posts pinned to buildings or rooms. They show up on
          the public campus home and on the map.
        </p>
      </div>

      <NewsAdminClient mapId={mapId} initialPosts={posts} />
    </div>
  );
}
