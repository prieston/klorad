import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { listEventsForAdmin } from "@/lib/events-db";
import { EventsAdminClient } from "./EventsAdminClient";

type Params = Promise<{ orgId: string; mapId: string }>;

/**
 * `/org/[orgId]/maps/[mapId]/events` — admin events authoring.
 *
 * Lists events (newest scheduled first) + an inline create form.
 * Backed by the `EventPost` model from Arc 3 of
 * [[campus-consumer-pivot]]. ICS-feed-sourced recurring events are
 * untouched and continue to render via `events-server.ts`.
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
  const events = await listEventsForAdmin(mapId);

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
          Events
        </h1>
        <p className="mt-1 text-sm text-text-tertiary">
          Anything happening on campus — pinned to a building or room.
          Recurring ICS feeds keep rendering separately.
        </p>
      </div>

      <EventsAdminClient
        mapId={mapId}
        initialEvents={events}
        indoorMapId={indoorMapId}
      />
    </div>
  );
}
