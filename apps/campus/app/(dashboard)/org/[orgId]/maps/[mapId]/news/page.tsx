import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { listNewsForAdmin } from "@/lib/news";
import { NewsAdminClient } from "./NewsAdminClient";
import { PageHeader } from "@/app/(dashboard)/components/PageHeader";
import { OpenPublicAction } from "@/app/(dashboard)/components/OpenPublicAction";

type Params = Promise<{ orgId: string; mapId: string }>;

/**
 * `/org/[orgId]/maps/[mapId]/news` — news authoring under the new
 * backoffice IA. The left rail handles "back to campus" navigation,
 * so this page no longer needs an inline back link; `PageHeader` is
 * the consistent chrome across every rail destination.
 *
 * Width + layout match the Events page so the rector's eye lands in
 * the same place across every Public surface tab. The PhonePreview
 * pattern lived here as the Phase 4b pilot but was breaking out of
 * the rail at 1400px and crowding the form — pulled out.
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
    <div className="mx-auto w-full max-w-[1280px] px-6 py-8 md:px-10">
      <PageHeader
        eyebrow="Public surface"
        title="News"
        subtitle="Posts pinned to buildings or rooms. Surface on the public home and the news feed."
        actions={<OpenPublicAction href={`/campus/${mapId}/news`} />}
      />

      <NewsAdminClient
        mapId={mapId}
        initialPosts={posts}
        indoorMapId={indoorMapId}
        pushEnabled={Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)}
      />
    </div>
  );
}
