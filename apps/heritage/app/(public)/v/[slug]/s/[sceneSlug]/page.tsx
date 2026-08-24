import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { pickLocalized } from "@/lib/heritage/i18n";
import { SceneExplorer } from "./SceneExplorer";

type Params = Promise<{ slug: string; sceneSlug: string }>;
type Search = Promise<{ lang?: string }>;

/**
 * HER-101 — the scene explorer.
 *
 * The captured scene as the primary interface, with points of interest
 * attached to proxy geometry rather than floating in space. A splat cloud
 * contains no objects and a raycast into it hits nothing, so the proxies a
 * curator placed *are* the interaction — this page is where that authoring
 * pays off.
 *
 * The list of what is in the scene renders server-side and is complete on its
 * own. §7.1.1 makes that mandatory rather than optional, and it is also what a
 * visitor sees while the geometry downloads.
 */
async function load(slug: string, sceneSlug: string) {
  return prisma.heritageScene.findFirst({
    where: {
      slug: sceneSlug,
      state: "published",
      venue: { slug, project: { isPublished: true } },
    },
    include: {
      venue: {
        select: { slug: true, name: true, languages: true, defaultLanguage: true },
      },
      space: { select: { name: true } },
      layers: {
        orderBy: { sortOrder: "asc" },
        include: {
          representation: {
            include: { files: true },
          },
        },
      },
      proxies: {
        where: { state: "published" },
        orderBy: { sortOrder: "asc" },
        include: {
          object: {
            select: { slug: true, title: true, description: true, identifier: true },
          },
        },
      },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug, sceneSlug } = await params;
  const s = await load(slug, sceneSlug);
  if (!s) return { title: "Not found" };
  return {
    title: pickLocalized(s.title, s.venue.defaultLanguage, "en") ?? "Scene",
  };
}

export default async function ScenePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { slug, sceneSlug } = await params;
  const { lang } = await searchParams;
  const s = await load(slug, sceneSlug);
  if (!s) notFound();

  const language = lang ?? s.venue.defaultLanguage;
  const t = (v: unknown) => pickLocalized(v, language, s.venue.defaultLanguage);

  // Splat layers are deliberately skipped: nothing splat-related renders until
  // the Phase 0a headset measurement exists. A scene composed of them shows
  // its record and says the geometry is not available yet, rather than
  // failing.
  const layers = s.layers
    .filter((l) => l.representation.kind === "mesh")
    .flatMap((l) => {
      const file = l.representation.files.find(
        (f) => f.url && (f.purpose === "delivery" || f.purpose === "master"),
      );
      return file?.url
        ? [{ id: l.id, url: file.url, transform: l.transform ?? undefined }]
        : [];
    });

  const skippedSplats = s.layers.filter(
    (l) => l.representation.kind === "splat",
  ).length;

  const proxies = s.proxies.map((p) => ({
    id: p.id,
    shape: p.shape,
    transform: p.transform,
    label: t(p.label) ?? t(p.object?.title) ?? null,
    objectSlug: p.object?.slug ?? null,
    identifier: p.object?.identifier ?? null,
    description: t(p.object?.description) ?? null,
  }));

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10 md:px-10">
      <Link
        href={`/v/${s.venue.slug}${lang ? `?lang=${lang}` : ""}`}
        className="inline-flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-primary"
      >
        <ArrowLeft size={13} strokeWidth={1.8} aria-hidden />
        {t(s.venue.name) ?? "Back"}
      </Link>

      <h1 className="mt-4 text-3xl font-light leading-[1.1] text-text-primary md:text-4xl">
        {t(s.title) ?? s.slug}
      </h1>
      {s.space ? (
        <p className="mt-1 text-sm text-text-tertiary">{t(s.space.name)}</p>
      ) : null}
      {t(s.description) ? (
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-text-secondary">
          {t(s.description)}
        </p>
      ) : null}

      <SceneExplorer
        venueSlug={s.venue.slug}
        language={lang ?? null}
        layers={layers}
        proxies={proxies}
        skippedSplats={skippedSplats}
      />
    </main>
  );
}
