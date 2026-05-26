import { Calendar, MapPin, Newspaper, Users } from "lucide-react";
import type { Locale } from "@/app/lib/i18n-core";
import { ConsumerNav } from "./ConsumerNav";
import { ConsumerHero } from "./ConsumerHero";
import { QuickTile } from "./QuickTile";
import { EventCard } from "./EventCard";
import { ClubRow } from "./ClubRow";
import { NewsItem } from "./NewsItem";
import { ConsumerFooter } from "./ConsumerFooter";
import {
  SAMPLE_CLUBS,
  SAMPLE_EVENTS,
  SAMPLE_NEWS,
} from "../sample-campus";
import type { ConsumerNews } from "./types";

export interface ConsumerHomeProps {
  token: string;
  campusName: string;
  /** Per-org accent — overrides `--brand-primary` for the whole page. */
  accentColor?: string;
  logoUrl?: string;
  locale: Locale;
  /** Optional org-set hero copy; defaults to the platform marketing line. */
  headline?: string;
  subheading?: string;
  /** Real venue thumbnail for the hero's MapTeaser. */
  mapThumbnailUrl?: string;
  /**
   * News items rendered in the News rail. Defaults to the sample seed
   * when the page hasn't (yet) loaded real posts — keeps the layout
   * populated for new tenants without forcing them to author first.
   */
  news?: ConsumerNews[];
}

/**
 * The new consumer home — top-level layout for the public-facing
 * campus surface ([[campus-consumer-pivot]] Arc 1).
 *
 * Renders the spec's six bands top-to-bottom: nav · hero with map
 * teaser · 3 quick-action tiles · events grid · two-column (clubs
 * + news) bottom row · footer. Sample data drives the rails; Arcs
 * 2 – 5 swap each source from constants to API without changing
 * the markup.
 *
 * The whole page is wrapped in `data-consumer`, which (a) restores
 * the border + list resets Tailwind preflight would have done and
 * (b) makes the consumer palette CSS vars apply. Per-org
 * `accentColor` overrides `--brand-primary` via inline style.
 */
export function ConsumerHome({
  token,
  campusName,
  accentColor,
  logoUrl,
  locale,
  headline,
  subheading,
  mapThumbnailUrl,
  news,
}: ConsumerHomeProps) {
  const newsItems = news?.length ? news : SAMPLE_NEWS;
  const lang = `?lang=${locale}`;
  const mapHref = `/campus/${token}/map${lang}`;
  // Per-org accent overrides the default purple at the wrapper, so
  // every descendant that uses `var(--brand-primary)` follows suit.
  const themeStyle = accentColor
    ? ({ ["--brand-primary" as string]: accentColor } as React.CSSProperties)
    : undefined;

  return (
    <main data-consumer lang={locale} style={themeStyle}>
      <ConsumerNav
        campusName={campusName}
        logoUrl={logoUrl}
        token={token}
        locale={locale}
      />

      <ConsumerHero
        headline={headline ?? "Your whole campus, one happy little app."}
        subheading={
          subheading ??
          "Find any building, jump into events, and meet your people — without 12 tabs open."
        }
        primaryHref={mapHref}
        primaryLabel="Get started — it's free"
        secondaryHref={`/campus/${token}/tour${lang}`}
        secondaryLabel="Watch the tour"
        mapHref={mapHref}
        mapThumbnailUrl={mapThumbnailUrl}
      />

      <section className="mx-auto grid max-w-[1280px] grid-cols-1 gap-4 px-4 md:grid-cols-3 md:gap-6 md:px-6">
        <QuickTile
          href={mapHref}
          icon={MapPin}
          accent="purple"
          label="Find a building"
          subtitle="Walking time + indoor maps"
        />
        <QuickTile
          href={`/campus/${token}/clubs${lang}`}
          icon={Users}
          accent="pink"
          label="Browse clubs"
          subtitle={`${SAMPLE_CLUBS.length}+ on campus`}
        />
        <QuickTile
          href={`/campus/${token}/events${lang}`}
          icon={Calendar}
          accent="teal"
          label="This week's events"
          subtitle={`${SAMPLE_EVENTS.length} happening near you`}
        />
      </section>

      <section className="mx-auto mt-12 max-w-[1280px] px-4 md:px-6">
        <h2 className="text-lg font-medium text-[var(--brand-text)]">
          Happening this week
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-3">
          {SAMPLE_EVENTS.map((e) => (
            <EventCard
              key={e.id}
              event={e}
              href={`/campus/${token}/events/${e.id}${lang}`}
            />
          ))}
        </div>
      </section>

      <section className="mx-auto mt-12 grid max-w-[1280px] grid-cols-1 gap-6 px-4 md:grid-cols-[1.4fr_1fr] md:gap-10 md:px-6">
        <div>
          <h2 className="text-lg font-medium text-[var(--brand-text)]">
            Most active clubs this week
          </h2>
          <p className="mt-1 text-xs text-[var(--brand-text-muted)]">
            Sorted by activity — no tracking
          </p>
          <div className="mt-4">
            {SAMPLE_CLUBS.map((c) => (
              <ClubRow key={c.id} club={c} />
            ))}
          </div>
        </div>

        <div>
          <h2 className="inline-flex items-center gap-2 text-lg font-medium text-[var(--brand-text)]">
            <Newspaper size={18} strokeWidth={1.75} />
            Campus news
          </h2>
          <div className="mt-4">
            {newsItems.map((n) => (
              <NewsItem
                key={n.id}
                item={n}
                href={`/campus/${token}/news/${n.id}${lang}`}
              />
            ))}
          </div>
        </div>
      </section>

      <ConsumerFooter campusName={campusName} />
    </main>
  );
}
