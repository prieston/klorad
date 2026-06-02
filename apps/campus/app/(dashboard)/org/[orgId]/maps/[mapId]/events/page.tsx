import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { listEventsForAdmin } from "@/lib/events-db";
import { readEventFeeds } from "@/lib/events";
import { EventsAdminClient } from "./EventsAdminClient";
import { IcsFeedsManager } from "./IcsFeedsManager";
import { NotifyForm } from "./NotifyForm";
import { PageHeader } from "@/app/(dashboard)/components/PageHeader";
import { OpenPublicAction } from "@/app/(dashboard)/components/OpenPublicAction";

type Params = Promise<{ orgId: string; mapId: string }>;

/**
 * `/org/[orgId]/maps/[mapId]/events` — admin events authoring under
 * the new backoffice IA. Ships under `PageHeader`; the rail handles
 * "back to campus" so the inline back link is gone. The phone
 * preview pane lands in a follow-up — News is the Phase 4b pilot.
 */
export default async function EventsAdminPage({
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
  const initialFeeds = readEventFeeds(project.sceneData);
  const events = await listEventsForAdmin(mapId);

  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-8 md:px-10">
      <PageHeader
        eyebrow="Public surface"
        title="Events"
        subtitle="Native events plus synced ICS feeds. Flag the ones that bubble into Happening today."
        actions={<OpenPublicAction href={`/campus/${mapId}/events`} />}
      />

      <div className="space-y-6">
        <EventsAdminClient
          mapId={mapId}
          initialEvents={events}
          indoorMapId={indoorMapId}
        />
        <IcsFeedsManager mapId={mapId} initialFeeds={initialFeeds} />
        <NotifyForm
          mapId={mapId}
          enabled={Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)}
        />
      </div>
    </div>
  );
}
