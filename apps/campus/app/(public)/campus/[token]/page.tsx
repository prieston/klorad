import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { KloradMark } from "@klorad/design-system";
import { prisma } from "@/lib/prisma";
import { formatPostDate, readPosts } from "@/lib/posts";
import { formatEventWhen, readEventFeeds } from "@/lib/events";
import { fetchCampusEvents } from "@/lib/events-server";
import { readHomePage } from "@/lib/home-page";
import { detectLocale, pickText, translate } from "@/app/lib/i18n-core";
import NotPublishedPlaceholder from "./NotPublishedPlaceholder";
import { HomeLangToggle } from "./HomeLangToggle";

type Params = Promise<{ token: string }>;

interface CampusBranding {
  name?: string;
  logo?: string;
  primaryColor?: string;
}

function isValidHex(value: string | undefined): value is string {
  return !!value && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}

/** Location-pin glyph for a post's linked place. */
function PinIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2C8 2 5 5 5 9c0 5.5 7 13 7 13s7-7.5 7-13c0-4-3-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z" />
    </svg>
  );
}

/** Dynamic metadata so shared URLs preview nicely in Slack / WhatsApp / LinkedIn. */
export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { token } = await params;
  const map = await prisma.project
    .findUnique({
      where: { id: token },
      select: { title: true, sceneData: true },
    })
    .catch(() => null);

  const scene = (map?.sceneData ?? null) as {
    branding?: { name?: string };
  } | null;
  const name = scene?.branding?.name || map?.title || "Campus";
  const description = `${name} — campus news, events, and an interactive 3D map with step-free indoor wayfinding.`;

  return {
    title: name,
    description,
    openGraph: {
      title: `${name} · Klorad Campus`,
      description,
      type: "website",
      siteName: "Klorad Campus",
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} · Klorad Campus`,
      description,
    },
  };
}

/**
 * `/campus/[token]` — the public campus home page.
 *
 * The branded landing for a campus: news, and a route into the 3D
 * map (`/campus/[token]/map`). Server-rendered so news is in the
 * HTML for SEO and link previews.
 *
 * Gated on `isPublished`: unknown → 404, draft → "coming soon"
 * placeholder, published → the home.
 */
export default async function CampusHomePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const locale = detectLocale(typeof sp.lang === "string" ? sp.lang : null);

  const map = await prisma.project
    .findUnique({
      where: {
        id: token,
      },
      select: {
        id: true,
        title: true,
        description: true,
        isPublished: true,
        thumbnail: true,
        sceneData: true,
      },
    })
    .catch(() => null);

  if (!map) notFound();
  if (!map.isPublished) return <NotPublishedPlaceholder name={map.title} />;

  const scene = (map.sceneData ?? {}) as { branding?: CampusBranding };
  const branding = scene.branding ?? {};
  const displayName = branding.name || map.title;
  const accent = isValidHex(branding.primaryColor)
    ? branding.primaryColor
    : "#158ca3";
  const posts = readPosts(map.sceneData);
  const events = await fetchCampusEvents(readEventFeeds(map.sceneData));
  const mapHref = `/campus/${token}/map`;

  // Home page builder config — bilingual fields resolved to the
  // visitor's locale, each falling back to a sensible default.
  const home = readHomePage(map.sceneData);
  const heroBg = home.heroImage || map.thumbnail || null;
  const headline = pickText(home.headline, locale) || displayName;
  const tagline = pickText(home.tagline, locale) || map.description || "";
  const ctaLabel =
    pickText(home.ctaLabel, locale) || translate(locale, "home.exploreMap");
  const showEvents = home.showEvents !== false;
  const showNews = home.showNews !== false;

  return (
    <main lang={locale} className="min-h-screen bg-bg">
      <header className="flex items-center justify-between gap-4 px-6 py-4 md:px-10">
        {branding.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={branding.logo}
            alt={displayName}
            className="h-8 max-w-[200px] object-contain"
          />
        ) : (
          <span className="text-lg font-semibold text-text-primary">
            {displayName}
          </span>
        )}
        <div className="flex items-center gap-3">
          <HomeLangToggle token={token} current={locale} />
          <Link
            href={mapHref}
            className="text-sm font-medium transition-opacity hover:opacity-80"
            style={{ color: accent }}
          >
            {translate(locale, "home.openMap")} →
          </Link>
        </div>
      </header>

      <section
        className="relative flex min-h-[56vh] items-end overflow-hidden px-6 py-12 md:px-10 md:py-16"
        style={
          heroBg
            ? {
                backgroundImage: `linear-gradient(to top, rgba(11,17,22,0.9), rgba(11,17,22,0.35)), url("${heroBg}")`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : {
                background: `linear-gradient(155deg, ${accent} 0%, #0b1116 100%)`,
              }
        }
      >
        <div className="max-w-3xl">
          <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">
            {headline}
          </h1>
          {tagline ? (
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-white/85">
              {tagline}
            </p>
          ) : null}
          <Link
            href={mapHref}
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold shadow-sm transition-transform hover:scale-[1.02]"
            style={{ color: accent }}
          >
            {ctaLabel} →
          </Link>
        </div>
      </section>

      {showEvents && events.length > 0 ? (
        <section className="px-6 pb-4 md:px-10">
          <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-text-tertiary">
            {translate(locale, "home.events")}
          </h2>
          <div className="mt-4 space-y-3">
            {events.map((event) => (
              <article
                key={event.id}
                className="flex items-baseline gap-4 rounded-2xl bg-surface-1 px-5 py-4 shadow-glass"
              >
                <time
                  className="shrink-0 text-xs font-medium"
                  style={{ color: accent }}
                >
                  {formatEventWhen(event.start, event.allDay)}
                </time>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-text-primary">
                    {event.title}
                  </h3>
                  {event.location ? (
                    <p className="truncate text-xs text-text-tertiary">
                      {event.location}
                    </p>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {showNews ? (
      <section className="px-6 pb-20 pt-8 md:px-10">
        <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-text-tertiary">
          {translate(locale, "home.news")}
        </h2>
        {posts.length > 0 ? (
          <div className="mt-4 space-y-4">
            {posts.map((post) => (
              <article
                key={post.id}
                className="rounded-2xl bg-surface-1 p-6 shadow-glass"
              >
                <time className="text-xs text-text-tertiary">
                  {formatPostDate(post.publishedAt)}
                </time>
                <h3 className="mt-1 text-lg font-semibold text-text-primary">
                  {pickText(post.title, locale)}
                </h3>
                {pickText(post.body, locale) ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
                    {pickText(post.body, locale)}
                  </p>
                ) : null}
                {post.place ? (
                  <Link
                    href={`${mapHref}?place=${encodeURIComponent(post.place.id)}`}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent transition-opacity hover:opacity-80"
                  >
                    <PinIcon className="h-3 w-3" />
                    {post.place.name}
                  </Link>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-text-tertiary">
            {translate(locale, "home.noNews")}
          </p>
        )}
      </section>
      ) : null}

      <footer className="border-t border-solid border-line-soft px-6 py-6 text-center md:px-10">
        <span className="inline-flex items-center gap-1.5 text-[0.7rem] uppercase tracking-[0.18em] text-text-tertiary">
          <KloradMark className="h-4 w-4" />
          Powered by Klorad
        </span>
      </footer>
    </main>
  );
}
