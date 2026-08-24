import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { pickLocalized } from "@/lib/heritage/i18n";
import { OrgClient } from "./OrgClient";

type Params = Promise<{ orgId: string }>;

export const metadata = { title: "Venues" };

/**
 * `/org/[orgId]` — the venue list.
 *
 * A Heritage venue is a `Project` that carries a `HeritageVenue` row, so the
 * filter is the relation rather than `Project.engine` — Campus and Mobility
 * both write `mapbox` into that column, which makes it useless as a vertical
 * discriminator.
 */
export default async function OrgVenuesPage({ params }: { params: Params }) {
  const { orgId } = await params;
  const session = await auth();
  if (!session?.user?.id) notFound();

  const membership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: { organizationId: orgId, userId: session.user.id },
    },
    select: { role: true },
  });
  if (!membership) notFound();

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true },
  });
  if (!org) notFound();

  const venues = await prisma.heritageVenue.findMany({
    where: { project: { organizationId: orgId } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      kind: true,
      name: true,
      languages: true,
      defaultLanguage: true,
      createdAt: true,
      project: { select: { id: true, isPublished: true } },
      _count: {
        select: {
          objects: true,
          representations: true,
          scenes: true,
          proxies: true,
        },
      },
    },
  });

  return (
    <OrgClient
      orgId={orgId}
      orgName={org.name}
      initialVenues={venues.map((v) => ({
        id: v.id,
        projectId: v.project.id,
        slug: v.slug,
        kind: v.kind,
        // Resolve for the curator's own reading, defaulting to the venue's
        // default language. Falls back through `pickLocalized` rather than
        // rendering an empty card title.
        name: pickLocalized(v.name, v.defaultLanguage, "en") ?? "Untitled venue",
        languageCount: v.languages.length,
        isPublished: v.project.isPublished,
        createdAt: v.createdAt.toISOString(),
        objectCount: v._count.objects,
        representationCount: v._count.representations,
        sceneCount: v._count.scenes,
        proxyCount: v._count.proxies,
      }))}
    />
  );
}
