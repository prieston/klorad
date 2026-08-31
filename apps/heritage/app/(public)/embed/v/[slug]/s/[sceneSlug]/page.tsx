import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { pickLocalized } from "@/lib/heritage/i18n";
import { EmbedFrame } from "@/lib/heritage/ui/EmbedFrame";

type Params = Promise<{ slug: string; sceneSlug: string }>;
type Search = Promise<{ lang?: string }>;

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Embeddable scene explorer — same contract as the object embed. */
export default async function EmbedScenePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { slug, sceneSlug } = await params;
  const { lang } = await searchParams;

  const scene = await prisma.heritageScene.findFirst({
    where: {
      slug: sceneSlug,
      state: "published",
      venue: { slug, project: { isPublished: true } },
    },
    include: {
      venue: { select: { slug: true, name: true, defaultLanguage: true } },
      layers: {
        orderBy: { sortOrder: "asc" },
        include: { representation: { include: { files: true } } },
      },
      proxies: {
        where: { state: "published" },
        orderBy: { sortOrder: "asc" },
        select: { id: true, shape: true, transform: true, label: true },
      },
    },
  });
  if (!scene) notFound();

  const language = lang ?? scene.venue.defaultLanguage;
  const t = (v: unknown) => pickLocalized(v, language, scene.venue.defaultLanguage);

  const layers = scene.layers
    .filter((l) => l.representation.kind === "mesh")
    .flatMap((l) => {
      const file = l.representation.files.find(
        (f) => f.url && (f.purpose === "delivery" || f.purpose === "master"),
      );
      return file?.url
        ? [{ id: l.id, url: file.url, transform: l.transform ?? undefined }]
        : [];
    });

  return (
    <EmbedFrame
      title={t(scene.title) ?? scene.slug}
      subtitle={t(scene.venue.name) ?? null}
      canonicalPath={`/v/${scene.venue.slug}/s/${scene.slug}`}
      rightsLabel={null}
      rightsUri={null}
      layers={layers}
      proxies={scene.proxies.map((p) => ({
        id: p.id,
        shape: p.shape,
        transform: p.transform,
        label: t(p.label),
      }))}
    />
  );
}
