import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Accessibility, Clock, Route } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ViewBeacon } from "@/lib/heritage/ui/ViewBeacon";
import { pickLocalized } from "@/lib/heritage/i18n";
import { deliveryUrlFor } from "@/lib/heritage/delivery";
import { languageName, uiStrings, viewerStrings } from "@/lib/heritage/ui-strings";
import { TourPlayer } from "./TourPlayer";

type Params = Promise<{ slug: string; tourSlug: string }>;
type Search = Promise<{ lang?: string; stop?: string }>;

/**
 * HER-104 — a guided tour, as a visitor experiences it.
 *
 * Tours were authorable and unreachable: the venue page listed them as text
 * with no link, so a curator could sequence a dozen stops and no one could
 * ever walk them.
 *
 * The thing that makes this a tour rather than a list of links is the camera.
 * Each stop carries an authored `cameraPose` — a curator decided where to
 * stand to see what the stop is about — and moving between stops flies there.
 * Arriving at the default framing instead would silently discard the only
 * editorial decision that distinguishes a tour from a search result.
 *
 * Every stop is also rendered as text below the viewer. §10.1 makes that
 * mandatory, and it doubles as the version that works before the geometry
 * downloads, on a locked-down museum kiosk, and for the visitor who simply
 * wants to read.
 */
async function load(slug: string, tourSlug: string) {
  return prisma.heritageTour.findFirst({
    where: {
      slug: tourSlug,
      state: "published",
      venue: { slug, project: { isPublished: true } },
    },
    include: {
      venue: {
        select: {
          slug: true,
          name: true,
          languages: true,
          defaultLanguage: true,
          scanOfPublicDomainAssertsRights: true,
        },
      },
      stops: {
        orderBy: { sortOrder: "asc" },
        include: {
          object: {
            select: {
              id: true,
              slug: true,
              title: true,
              description: true,
              rights: true,
              state: true,
              representations: {
                where: { state: "published", kind: { in: ["mesh", "panorama"] } },
                orderBy: { createdAt: "asc" },
                include: { files: true },
              },
            },
          },
          scene: {
            select: {
              id: true,
              slug: true,
              title: true,
              state: true,
              layers: {
                orderBy: { sortOrder: "asc" },
                include: {
                  representation: {
                    include: { files: true, object: { select: { rights: true } } },
                  },
                },
              },
            },
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
  const { slug, tourSlug } = await params;
  const tour = await load(slug, tourSlug);
  if (!tour) return { title: "Not found" };

  const lang = tour.venue.defaultLanguage;
  const canonical = `/v/${tour.venue.slug}/t/${tour.slug}`;
  return {
    title: pickLocalized(tour.title, lang, "en") ?? "Tour",
    description: pickLocalized(tour.description, lang, "en") ?? undefined,
    alternates: {
      canonical,
      languages: Object.fromEntries(
        tour.venue.languages.map((l) => [l, `${canonical}?lang=${l}`]),
      ),
    },
  };
}

export default async function TourPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { slug, tourSlug } = await params;
  const { lang, stop } = await searchParams;

  const tour = await load(slug, tourSlug);
  if (!tour) notFound();

  const language = lang ?? tour.venue.defaultLanguage;
  const ui = uiStrings(language);
  const t = (v: unknown) => pickLocalized(v, language, tour.venue.defaultLanguage);

  // Resolve every stop's geometry up front. Signing is local, and a tour is a
  // sequence a visitor will walk anyway — fetching each stop on demand would
  // put a network round trip between pressing Next and seeing anything.
  const stops = await Promise.all(
    tour.stops.map(async (s) => {
      const scene = s.scene?.state === "published" ? s.scene : null;
      const object = s.object?.state === "published" ? s.object : null;

      let layers: { id: string; url: string; transform?: unknown }[] = [];

      if (scene) {
        layers = (
          await Promise.all(
            scene.layers
              .filter((l) => l.representation.kind === "mesh")
              .map(async (l) => {
                const file = l.representation.files.find(
                  (f) => f.purpose === "delivery",
                );
                if (!file) return null;
                const url = await deliveryUrlFor(file, {
                  objectRights: l.representation.object?.rights ?? null,
                  representationRights: l.representation.rights,
                  scanAssertsRights: tour.venue.scanOfPublicDomainAssertsRights,
                });
                return url
                  ? { id: l.id, url, transform: l.transform ?? undefined }
                  : null;
              }),
          )
        ).flatMap((l) => (l ? [l] : []));
      } else if (object) {
        layers = (
          await Promise.all(
            object.representations.slice(0, 1).map(async (r) => {
              const file = r.files.find((f) => f.purpose === "delivery");
              if (!file) return null;
              const url = await deliveryUrlFor(file, {
                objectRights: object.rights,
                representationRights: r.rights,
                scanAssertsRights: tour.venue.scanOfPublicDomainAssertsRights,
              });
              return url ? { id: r.id, url } : null;
            }),
          )
        ).flatMap((l) => (l ? [l] : []));
      }

      return {
        id: s.id,
        title: t(s.title) ?? "",
        body: t(s.body),
        cameraPose: s.cameraPose as {
          position?: [number, number, number];
          target?: [number, number, number];
          fov?: number;
        } | null,
        layers,
        // Where "read more" goes. A stop is a curated excerpt; the full record
        // lives on the object or scene page and must stay reachable.
        href: object
          ? `/v/${tour.venue.slug}/o/${object.slug}${lang ? `?lang=${lang}` : ""}`
          : scene
            ? `/v/${tour.venue.slug}/s/${scene.slug}${lang ? `?lang=${lang}` : ""}`
            : null,
        contextLabel: object
          ? (t(object.title) ?? null)
          : scene
            ? (t(scene.title) ?? null)
            : null,
      };
    }),
  );

  const requested = Number(stop);
  const initialStop =
    Number.isInteger(requested) && requested >= 1 && requested <= stops.length
      ? requested - 1
      : 0;

  const title = t(tour.title) ?? tour.slug;
  const venueHref = `/v/${tour.venue.slug}${lang ? `?lang=${lang}` : ""}`;

  return (
    <main lang={language} className="mx-auto w-full max-w-5xl px-6 py-10 md:px-10">
      <ViewBeacon
        venueSlug={tour.venue.slug}
        kind="tour"
        targetSlug={tour.slug}
        language={language}
      />

      <Link
        href={venueHref}
        className="inline-flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-primary"
      >
        <ArrowLeft size={13} strokeWidth={1.8} aria-hidden />
        {t(tour.venue.name) ?? ui("backToVenue")}
      </Link>

      <header className="mt-4">
        <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.28em] text-text-tertiary">
          <Route size={13} strokeWidth={1.8} aria-hidden />
          {ui("tour")}
        </span>
        <h1 className="mt-2 text-3xl font-light leading-[1.05] text-text-primary md:text-4xl">
          {title}
        </h1>
        {t(tour.description) ? (
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-secondary">
            {t(tour.description)}
          </p>
        ) : null}

        <ul className="mt-4 flex flex-wrap items-center gap-2 text-[11px]">
          <li className="rounded-full bg-surface-2 px-2.5 py-1 text-text-secondary">
            {stops.length} {ui("stops")}
          </li>
          {tour.estimatedMinutes ? (
            <li className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-text-secondary">
              <Clock size={11} strokeWidth={1.9} aria-hidden />
              {tour.estimatedMinutes} {ui("minutes")}
            </li>
          ) : null}
          {tour.isAccessibleRoute ? (
            // §7.1.11: a step-free route is a first-class fact, not a footnote.
            // Someone deciding whether to travel to a site needs it before they
            // commit, which means on the badge line and not in the description.
            <li className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-700">
              <Accessibility size={11} strokeWidth={1.9} aria-hidden />
              {ui("accessibleRouteNote")}
            </li>
          ) : null}
          {tour.mode !== "both" ? (
            <li className="rounded-full bg-surface-2 px-2.5 py-1 text-text-tertiary">
              {tour.mode === "screen" ? ui("screenOnly") : ui("headsetOnly")}
            </li>
          ) : null}
        </ul>
      </header>

      {stops.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-line-soft p-8 text-center text-sm text-text-tertiary">
          {ui("noStops")}
        </p>
      ) : (
        <TourPlayer
          stops={stops}
          initialStop={initialStop}
          language={language}
          querystringLang={lang ?? null}
          basePath={`/v/${tour.venue.slug}/t/${tour.slug}`}
          strings={{
            stopOf: ui("stopOf"),
            previous: ui("previous"),
            next: ui("next"),
            endOfTour: ui("endOfTour"),
            allStops: ui("allStops"),
            readMore: ui("viewInCollection"),
            viewer: viewerStrings(language, 0),
            modelLabel: ui("modelLabel"),
            noGeometry: ui("noGeometry"),
          }}
        />
      )}

      {tour.venue.languages.length > 1 ? (
        <nav
          aria-label={ui("language")}
          className="mt-10 flex flex-wrap items-center gap-2"
        >
          {tour.venue.languages.map((tag) => (
            <a
              key={tag}
              href={`/v/${tour.venue.slug}/t/${tour.slug}?lang=${tag}`}
              aria-current={tag === language ? "true" : undefined}
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
    </main>
  );
}
