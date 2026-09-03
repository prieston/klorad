import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireVenueAccess } from "@/lib/authz";
import { pickLocalized } from "@/lib/heritage/i18n";
import { deliveryUrlFor } from "@/lib/heritage/delivery";
import { SceneComposer } from "./SceneComposer";

type Params = Promise<{ orgId: string; venueId: string; sceneId: string }>;

export const metadata = { title: "Scene" };

/**
 * Arrange a scene, seeing it.
 *
 * Composing used to mean picking a capture from a dropdown and typing a
 * transform, then opening the public page to find out what you had built. A
 * scene is a spatial arrangement; authoring it through a form is like laying
 * out a room by writing down coordinates and going next door to look.
 *
 * So the same viewer a visitor gets is the editing surface. Click a model to
 * select it, drag to move it, and what you see is what is published.
 */
export default async function ScenePage({ params }: { params: Params }) {
  const { orgId, venueId, sceneId } = await params;
  const access = await requireVenueAccess(venueId, "write");
  if (access.denied) notFound();

  const [venue, scene] = await Promise.all([
    prisma.heritageVenue.findUnique({
      where: { id: venueId },
      select: {
        languages: true,
        defaultLanguage: true,
        scanOfPublicDomainAssertsRights: true,
      },
    }),
    prisma.heritageScene.findFirst({
      where: { id: sceneId, venueId },
      include: {
        layers: {
          orderBy: { sortOrder: "asc" },
          include: {
            representation: {
              include: {
                files: true,
                object: { select: { id: true, title: true, rights: true } },
              },
            },
          },
        },
        proxies: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          include: { object: { select: { id: true, title: true } } },
        },
      },
    }),
  ]);
  if (!venue || !scene) notFound();

  const lang = venue.defaultLanguage;

  // Everything in the venue that has something to show. A curator arranging a
  // gallery picks from their items, not from a list of processing artefacts,
  // so this is phrased as items and only incidentally as representations.
  const available = await prisma.heritageRepresentation.findMany({
    where: {
      venueId,
      kind: "mesh",
      status: "ready",
      files: { some: { purpose: "delivery" } },
    },
    orderBy: { createdAt: "desc" },
    include: {
      files: true,
      object: { select: { id: true, title: true } },
    },
  });

  const inScene = new Set(scene.layers.map((l) => l.representationId));

  const layers = await Promise.all(
    scene.layers.map(async (l) => {
      const file = l.representation.files.find((f) => f.purpose === "delivery");
      const url = file
        ? await deliveryUrlFor(file, {
            objectRights: l.representation.object?.rights ?? null,
            representationRights: l.representation.rights,
            scanAssertsRights: venue.scanOfPublicDomainAssertsRights,
          })
        : null;
      return {
        id: l.id,
        representationId: l.representationId,
        label:
          pickLocalized(l.representation.object?.title, lang, "en") ??
          pickLocalized(l.representation.label, lang, "en") ??
          "Untitled",
        role: l.role,
        url,
        transform: l.transform ?? null,
        kind: l.representation.kind,
      };
    }),
  );

  return (
    <SceneComposer
      orgId={orgId}
      venueId={venueId}
      sceneId={scene.id}
      sceneTitle={pickLocalized(scene.title, lang, "en") ?? scene.slug}
      sceneState={scene.state}
      languages={venue.languages}
      defaultLanguage={lang}
      layers={layers}
      available={available
        .filter((r) => !inScene.has(r.id))
        .map((r) => ({
          id: r.id,
          label:
            pickLocalized(r.object?.title, lang, "en") ??
            pickLocalized(r.label, lang, "en") ??
            "Untitled",
        }))}
      proxies={scene.proxies.map((p) => ({
        id: p.id,
        label: pickLocalized(p.label, lang, "en") ?? "Point of interest",
        shape: p.shape as "box" | "sphere" | "cylinder" | "plane" | "mesh",
        transform: p.transform,
        objectId: p.objectId,
        invalidatedAt: p.invalidatedAt?.toISOString() ?? null,
      }))}
      objects={available.flatMap((r) =>
        r.object
          ? [
              {
                id: r.object.id,
                label: pickLocalized(r.object.title, lang, "en") ?? "Untitled",
              },
            ]
          : [],
      )}
    />
  );
}
