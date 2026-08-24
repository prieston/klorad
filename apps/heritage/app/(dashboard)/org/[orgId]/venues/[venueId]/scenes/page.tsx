import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireVenueAccess } from "@/lib/authz";
import { pickLocalized } from "@/lib/heritage/i18n";
import { ScenesClient } from "./ScenesClient";

type Params = Promise<{ orgId: string; venueId: string }>;

export const metadata = { title: "Scenes" };

/**
 * Scenes — the renderable units (§8, §5.2).
 *
 * A scene composes one or more representations through layers: a splat site
 * with mesh artifacts on plinths is the case the spec calls the strongest
 * product story. Authoring the *composition* is what this page does; the
 * viewer that renders it is a later arc.
 */
export default async function ScenesPage({ params }: { params: Params }) {
  const { venueId } = await params;
  const access = await requireVenueAccess(venueId, "read");
  if (access.denied) notFound();

  const venue = await prisma.heritageVenue.findUnique({
    where: { id: venueId },
    select: { languages: true, defaultLanguage: true },
  });
  if (!venue) notFound();

  const [scenes, spaces, representations] = await Promise.all([
    prisma.heritageScene.findMany({
      where: { venueId },
      orderBy: { createdAt: "desc" },
      include: {
        layers: {
          orderBy: { sortOrder: "asc" },
          include: {
            representation: {
              select: { id: true, kind: true, label: true, splatCount: true, triangleCount: true },
            },
          },
        },
        _count: { select: { proxies: true, tourStops: true } },
      },
    }),
    prisma.heritageSpace.findMany({
      where: { venueId },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, slug: true },
    }),
    prisma.heritageRepresentation.findMany({
      where: { venueId, kind: { in: ["mesh", "splat", "panorama"] } },
      orderBy: { createdAt: "desc" },
      select: { id: true, kind: true, label: true, status: true },
    }),
  ]);

  const lang = venue.defaultLanguage;

  return (
    <ScenesClient
      venueId={venueId}
      languages={venue.languages}
      defaultLanguage={lang}
      spaces={spaces.map((s) => ({
        id: s.id,
        label: pickLocalized(s.name, lang, "en") ?? s.slug,
      }))}
      representations={representations.map((r) => ({
        id: r.id,
        kind: r.kind,
        status: r.status,
        label: pickLocalized(r.label, lang, "en") ?? `${r.kind} capture`,
      }))}
      initial={scenes.map((s) => ({
        id: s.id,
        slug: s.slug,
        kind: s.kind,
        title: (s.title ?? {}) as Record<string, string>,
        description: (s.description ?? {}) as Record<string, string>,
        spaceId: s.spaceId,
        status: s.status,
        state: s.state,
        tilesetUrl: s.tilesetUrl,
        floorProxyUrl: s.floorProxyUrl,
        splatBudget: s.splatBudget,
        lastRecapturedAt: s.lastRecapturedAt?.toISOString() ?? null,
        proxyCount: s._count.proxies,
        tourStopCount: s._count.tourStops,
        layers: s.layers.map((l) => ({
          id: l.id,
          role: l.role,
          isVisible: l.isVisible,
          representationId: l.representationId,
          representationKind: l.representation.kind,
          representationLabel:
            pickLocalized(l.representation.label, lang, "en") ??
            `${l.representation.kind} capture`,
          splatCount: l.representation.splatCount,
          triangleCount: l.representation.triangleCount,
        })),
      }))}
    />
  );
}
