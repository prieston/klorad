import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { projectHasContent } from "@/lib/sample-seed";
import { readEventFeeds } from "@/lib/events";
import { OnboardingClient } from "./OnboardingClient";
import { CampusHealth } from "./CampusHealth";

type Params = Promise<{ orgId: string; mapId: string }>;

/**
 * `/org/[orgId]/maps/[mapId]/onboarding` — first-run wizard.
 *
 * Arc 7 of [[campus-consumer-pivot]]. Three-card hub that closes the
 * "rector signs up and nothing's there" gap:
 *
 *  - "Try with sample data" — POSTs to `/api/maps/[mapId]/seed-sample`
 *    so the public campus immediately has news / events / clubs /
 *    dining to look at. Disabled when the project already has
 *    content (the server endpoint also enforces this).
 *  - "Brand the campus" — deep-links to the existing Settings tab.
 *  - "Connect MappedIn" — deep-links to the existing Indoor tab.
 *
 * No intermediate state, no persisted progress — the page is just a
 * launcher. If the user wants more onboarding, they can walk through
 * each tab in their own time.
 */
export default async function OnboardingPage({
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
    select: {
      id: true,
      title: true,
      sceneData: true,
      thumbnail: true,
      isPublished: true,
    },
  });
  if (!project) notFound();

  const alreadySeeded = await projectHasContent(mapId);
  const scene = (project.sceneData ?? {}) as {
    branding?: { name?: string; logo?: string; primaryColor?: string };
    indoorMapId?: string;
  };
  const hasBranding = Boolean(
    scene.branding?.name || scene.branding?.logo || scene.branding?.primaryColor,
  );
  const hasIndoorMap = Boolean(scene.indoorMapId);

  // Per-rail counts for the health checklist. Run in parallel — a
  // missing model (pending migration) is the same `.catch(() => 0)`
  // graceful path the public surface uses.
  const [newsCount, eventsCount, clubsCount, diningCount] = await Promise.all([
    prisma.newsPost.count({ where: { projectId: mapId } }).catch(() => 0),
    prisma.eventPost.count({ where: { projectId: mapId } }).catch(() => 0),
    prisma.club.count({ where: { projectId: mapId } }).catch(() => 0),
    prisma.diningLocation.count({ where: { projectId: mapId } }).catch(() => 0),
  ]);
  const feedCount = readEventFeeds(project.sceneData).length;
  // Brand-completeness is a stricter check than `hasBranding` (any
  // one set) — we want all three for the badge to flip.
  const brandComplete = Boolean(
    scene.branding?.name &&
      scene.branding?.logo &&
      scene.branding?.primaryColor,
  );
  // Process-level env — only the server knows. Tells the admin
  // whether the AI chat is on this deployment.
  const assistantEnabled = Boolean(process.env.ANTHROPIC_API_KEY);

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
          Welcome to {project.title}
        </h1>
        <p className="mt-1 text-sm text-text-tertiary">
          Three quick steps to a campus students will actually open.
          Do them in any order; everything can be changed later.
        </p>
      </div>

      <OnboardingClient
        orgId={orgId}
        mapId={mapId}
        alreadySeeded={alreadySeeded}
        hasBranding={hasBranding}
        hasIndoorMap={hasIndoorMap}
        isPublished={project.isPublished}
      />

      <CampusHealth
        brandComplete={brandComplete}
        hasIndoorMap={hasIndoorMap}
        isPublished={project.isPublished}
        newsCount={newsCount}
        eventsCount={eventsCount}
        clubsCount={clubsCount}
        diningCount={diningCount}
        feedCount={feedCount}
        assistantEnabled={assistantEnabled}
      />
    </div>
  );
}
