import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { features } from "@/lib/env";
import DiscoveredPageClient from "./DiscoveredPageClient";

type Params = Promise<{ orgId: string; mapId: string }>;

export const metadata = {
  title: "Discovered",
};

/**
 * `/org/[orgId]/maps/[mapId]/discovered` — agentic-crawler inbox.
 *
 * One landing page for the whole feature: rector pastes URLs, hits
 * "Start crawl", the items the extractor surfaces land in tabbed
 * News / Events lists below for approve / reject. Phase 1 — no
 * persistent CrawlSource yet; pasting URLs is the only input.
 */
export default async function DiscoveredPage({
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

  return (
    <DiscoveredPageClient
      mapId={mapId}
      crawlerConfigured={features.crawler}
    />
  );
}
