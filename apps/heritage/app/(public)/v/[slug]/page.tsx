import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Boxes, Layers, Route } from "lucide-react";
import { KloradMark } from "@klorad/design-system";
import { prisma } from "@/lib/prisma";
import { ViewBeacon } from "@/lib/heritage/ui/ViewBeacon";
import { pickLocalized } from "@/lib/heritage/i18n";
import { languageName, uiStrings } from "@/lib/heritage/ui-strings";

type Params = Promise<{ slug: string }>;
type Search = Promise<{ lang?: string }>;

/**
 * Public venue page.
 *
 * Unauthenticated by design and by requirement: §7.1 sets minimum barrier to
 * entry (no install, no account), and §7.4.2 makes "no tenant login wall on
 * published objects" an acceptance criterion for oEmbed conformance — a
 * multi-tenant platform that accidentally gates this cannot be embedded by
 * Europeana or by the institution's own website.
 *
 * This arc ships the resolution and the listing, not the renderer. The scene
 * explorer (HER-101) and artifact viewer (HER-102) land with the Three.js
 * work; what exists here is the non-spatial equivalent that §7.1.1 and §10.1
 * require to be mandatory rather than optional — a list view of everything
 * reachable in the venue, which is also the honest answer for a blind visitor.
 */
async function loadVenue(slug: string) {
  return prisma.heritageVenue.findFirst({
    where: { slug, project: { isPublished: true } },
    select: {
      id: true,
      slug: true,
      kind: true,
      name: true,
      summary: true,
      languages: true,
      defaultLanguage: true,
      objects: {
        where: { state: "published" },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, slug: true, title: true, objectType: true },
      },
      scenes: {
        where: { state: "published" },
        orderBy: { createdAt: "asc" },
        select: { id: true, slug: true, title: true, kind: true },
      },
      tours: {
        where: { state: "published" },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          slug: true,
          title: true,
          estimatedMinutes: true,
          isAccessibleRoute: true,
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
  const { slug } = await params;
  const venue = await loadVenue(slug);
  if (!venue) return { title: "Not found" };
  const name = pickLocalized(venue.name, venue.defaultLanguage, "en");
  return {
    title: name ?? "Venue",
    description:
      pickLocalized(venue.summary, venue.defaultLanguage, "en") ?? undefined,
  };
}

export default async function PublicVenuePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { slug } = await params;
  const { lang } = await searchParams;
  const venue = await loadVenue(slug);
  if (!venue) notFound();

  // `?lang=` lets a QR code next to a label open straight into the visitor's
  // language. Falls back through the venue default rather than rendering
  // blank labels.
  const language = lang ?? venue.defaultLanguage;
  const ui = uiStrings(language);
  const t = (value: unknown) =>
    pickLocalized(value, language, venue.defaultLanguage);

  const name = t(venue.name) ?? "Venue";
  const summary = t(venue.summary);

  return (
    <main lang={language} className="mx-auto w-full max-w-3xl px-6 py-12 md:px-10">
      <ViewBeacon venueSlug={venue.slug} kind="venue" language={language} />
      <header className="mb-10">
        <KloradMark className="h-6 w-auto" title="Klorad" />
        <h1 className="mt-5 text-4xl font-light leading-[1.05] text-text-primary md:text-5xl">
          {name}
        </h1>
        {summary ? (
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-text-secondary">
            {summary}
          </p>
        ) : null}
        {venue.languages.length > 1 ? (
          <nav
            aria-label={ui("language")}
            className="mt-5 flex flex-wrap items-center gap-2"
          >
            {venue.languages.map((tag) => (
              <a
                key={tag}
                href={`/v/${venue.slug}?lang=${tag}`}
                // Marks the current choice for assistive technology. Colour
                // alone would leave a screen-reader user with no way to tell
                // which language they are already reading.
                aria-current={tag === language ? "true" : undefined}
                // The link text is in the language it names, so a screen
                // reader pronounces "Ελληνικά" as Greek rather than as
                // English nonsense.
                lang={tag}
                hrefLang={tag}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  tag === language
                    ? "bg-accent-soft text-accent"
                    : "bg-surface-2 text-text-secondary hover:text-text-primary"
                }`}
              >
                {languageName(tag)}
              </a>
            ))}
          </nav>
        ) : null}
      </header>

      <Listing
        icon={Layers}
        title={ui("scenes")}
        empty={ui("noScenes")}
        items={venue.scenes.map((s) => ({
          key: s.id,
          label: t(s.title) ?? s.slug,
          meta: s.kind,
          href: `/v/${venue.slug}/s/${s.slug}${lang ? `?lang=${lang}` : ""}`,
        }))}
      />
      <Listing
        icon={Route}
        title={ui("tours")}
        empty={ui("noTours")}
        items={venue.tours.map((tour) => ({
          key: tour.id,
          label: t(tour.title) ?? tour.slug,
          meta: [
            tour.estimatedMinutes
              ? `${tour.estimatedMinutes} ${ui("minutes")}`
              : null,
            tour.isAccessibleRoute ? ui("accessibleRoute") : null,
          ]
            .filter(Boolean)
            .join(" · "),
        }))}
      />
      <Listing
        icon={Boxes}
        title={ui("objects")}
        empty={ui("noObjects")}
        items={venue.objects.map((o) => ({
          key: o.id,
          label: t(o.title) ?? o.slug,
          meta: o.objectType ?? "",
          href: `/v/${venue.slug}/o/${o.slug}${lang ? `?lang=${lang}` : ""}`,
        }))}
      />
    </main>
  );
}

function Listing({
  icon: Icon,
  title,
  empty,
  items,
}: {
  icon: typeof Boxes;
  title: string;
  empty: string;
  items: Array<{ key: string; label: string; meta: string; href?: string }>;
}) {
  return (
    <section className="mb-10">
      <h2 className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.28em] text-text-tertiary">
        <Icon size={12} strokeWidth={1.8} aria-hidden />
        {title}
        {items.length > 0 ? (
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] tracking-normal text-accent">
            {items.length}
          </span>
        ) : null}
      </h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-text-tertiary">{empty}</p>
      ) : (
        <ul className="mt-3 divide-y divide-line-soft">
          {items.map((item) => (
            <li key={item.key} className="py-3">
              {item.href ? (
                <a
                  href={item.href}
                  className="text-sm text-text-primary hover:text-accent"
                >
                  {item.label}
                </a>
              ) : (
                <p className="text-sm text-text-primary">{item.label}</p>
              )}
              {item.meta ? (
                <p className="mt-0.5 text-xs text-text-tertiary">{item.meta}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
