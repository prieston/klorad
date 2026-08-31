import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireVenueAccess } from "@/lib/authz";
import { deliveryUrlFor } from "@/lib/heritage/delivery";
import { pickLocalized } from "@/lib/heritage/i18n";
import { ProxyAuthoring } from "./ProxyAuthoring";

type Params = Promise<{ orgId: string; venueId: string }>;
type Search = Promise<{ scene?: string }>;

export const metadata = { title: "Proxies" };

/**
 * HER-203 — proxy and annotation authoring.
 *
 * §5.3: a splat cloud contains no objects. No faces, no UVs, no named nodes,
 * no instance IDs — a raycast into it hits nothing, and view-consistent
 * semantic segmentation of splats is an open research problem rather than a
 * product feature. For a platform whose entire interaction model is "tap this
 * thing, read its record", that is a design constraint on everything.
 *
 * The resolution is invisible authored geometry registered to the capture,
 * each piece bound to a HeritageObject. The splat provides appearance; the
 * proxy provides interaction. The cost is manual labour per site, proportional
 * to how tappable the client wants it — which is why the spec says price it
 * per annotated object and build the tool first, not last.
 */
export default async function ProxiesPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { venueId } = await params;
  const { scene: sceneParam } = await searchParams;
  const access = await requireVenueAccess(venueId, "read");
  if (access.denied) notFound();

  const venue = await prisma.heritageVenue.findUnique({
    where: { id: venueId },
    select: {
      languages: true,
      defaultLanguage: true,
      scanOfPublicDomainAssertsRights: true,
    },
  });
  if (!venue) notFound();

  const scenes = await prisma.heritageScene.findMany({
    where: { venueId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      slug: true,
      title: true,
      lastRecapturedAt: true,
      _count: { select: { proxies: true } },
    },
  });

  const lang = venue.defaultLanguage;
  const activeSceneId = sceneParam ?? scenes[0]?.id ?? null;

  const [layers, proxies, objects] = activeSceneId
    ? await Promise.all([
        prisma.heritageSceneLayer.findMany({
          where: { sceneId: activeSceneId },
          orderBy: { sortOrder: "asc" },
          include: {
            representation: {
              include: { files: true, object: { select: { rights: true } } },
            },
          },
        }),
        prisma.heritageProxy.findMany({
          where: { sceneId: activeSceneId, venueId },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          include: { object: { select: { id: true, title: true } } },
        }),
        prisma.heritageObject.findMany({
          where: { venueId },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: { id: true, title: true, identifier: true },
        }),
      ])
    : [[], [], []];

  // Signed the same way the public pages sign, so an author is positioning
  // proxies against exactly the asset a visitor will load — not a privileged
  // view of it that might differ.
  const authorLayers = (
    await Promise.all(
      layers
        .filter((l) => l.representation.kind === "mesh")
        .map(async (l) => {
          const file = l.representation.files.find((f) => f.purpose === "delivery");
          if (!file) return null;
          const url = await deliveryUrlFor(file, {
            objectRights: l.representation.object?.rights ?? null,
            representationRights: l.representation.rights,
            scanAssertsRights: venue.scanOfPublicDomainAssertsRights,
          });
          return url ? { id: l.id, url, transform: l.transform ?? undefined } : null;
        }),
    )
  ).flatMap((l) => (l ? [l] : []));

  return (
    <ProxyAuthoring
      venueId={venueId}
      languages={venue.languages}
      defaultLanguage={lang}
      scenes={scenes.map((s) => ({
        id: s.id,
        label: pickLocalized(s.title, lang, "en") ?? s.slug,
        proxyCount: s._count.proxies,
        lastRecapturedAt: s.lastRecapturedAt?.toISOString() ?? null,
      }))}
      activeSceneId={activeSceneId}
      layers={authorLayers}
      hasSplatLayers={layers.some((l) => l.representation.kind === "splat")}
      objects={objects.map((o) => ({
        id: o.id,
        label:
          [pickLocalized(o.title, lang, "en"), o.identifier]
            .filter(Boolean)
            .join(" · ") || "Untitled object",
      }))}
      initialProxies={proxies.map((p) => ({
        id: p.id,
        shape: p.shape,
        interaction: p.interaction,
        transform: p.transform,
        label: (p.label ?? {}) as Record<string, string>,
        objectId: p.objectId,
        objectLabel: pickLocalized(p.object?.title, lang, "en"),
        state: p.state,
        invalidatedAt: p.invalidatedAt?.toISOString() ?? null,
      }))}
    />
  );
}
