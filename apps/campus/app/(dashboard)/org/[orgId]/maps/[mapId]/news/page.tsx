import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { listNewsForAdmin } from "@/lib/news";
import { NewsAdminClient } from "./NewsAdminClient";
import { PageHeader } from "@/app/(dashboard)/components/PageHeader";
import { PhonePreview } from "@/app/(dashboard)/components/PhonePreview";
import { OpenPublicAction } from "@/app/(dashboard)/components/OpenPublicAction";

type Params = Promise<{ orgId: string; mapId: string }>;

/**
 * `/org/[orgId]/maps/[mapId]/news` — news authoring under the new
 * backoffice IA. The left rail handles "back to campus" navigation,
 * so this page no longer needs an inline back link; `PageHeader` is
 * the consistent chrome across every rail destination.
 *
 * The phone preview on the right is the Phase 4b pilot of the
 * preview pattern — see `PhonePreview`. The pane loads the public
 * news route; the rector hits Refresh after Save to see the new
 * post land.
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
    select: { id: true, title: true, sceneData: true },
  });
  if (!project) notFound();

  const indoorMapId =
    (project.sceneData as { indoorMapId?: string } | null)?.indoorMapId ??
    null;
  const posts = await listNewsForAdmin(mapId);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-6 py-8 md:px-10">
      <PageHeader
        eyebrow="Public surface"
        title="News"
        subtitle="Posts pinned to buildings or rooms. Surface on the public home and the news feed."
        actions={<OpenPublicAction href={`/campus/${mapId}/news`} />}
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <NewsAdminClient
            mapId={mapId}
            initialPosts={posts}
            indoorMapId={indoorMapId}
          />
        </div>
        <aside className="hidden lg:block">
          <PhonePreview
            src={`/campus/${mapId}/news`}
            title="Public news preview"
          />
        </aside>
      </div>
    </div>
  );
}
