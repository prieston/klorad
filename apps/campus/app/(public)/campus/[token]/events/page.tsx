import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Compass } from "lucide-react";
import { getPublicCampusByToken } from "@/lib/public-campus";
import { detectLocale } from "@/app/lib/i18n-core";
import { listUpcomingEventsForProject } from "@/lib/events-db";
import { readEventFeeds, type CampusEvent } from "@/lib/events";
import { fetchCampusEvents } from "@/lib/events-server";
import { ConsumerFooter } from "@/lib/consumer/ConsumerFooter";
import { SegmentedTabs } from "@/lib/consumer/SegmentedTabs";
import { EventsListClient } from "@/lib/consumer/EventsListClient";

type Params = Promise<{ token: string }>;

interface CampusBranding {
  name?: string;
  logo?: string;
  primaryColor?: string;
}

function isValidHex(value: string | undefined): value is string {
  return !!value && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { token } = await params;
  const map = await getPublicCampusByToken(token);
  const scene = (map?.sceneData ?? null) as {
    branding?: { name?: string };
  } | null;
  const name = scene?.branding?.name || map?.title || "Campus";
  return {
    title: `Events · ${name}`,
    description: `What's happening on the ${name} campus this week and beyond.`,
  };
}

/**
 * `/campus/[token]/events` — public events list.
 *
 * Mirrors the home's "Happening this week" rail but in a single-page
 * list view: every upcoming and ongoing event in one place. Each row
 * links to its detail page; the anchor chip deep-links into MappedIn
 * when a `refId` is set.
 */
export default async function EventsPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const locale = detectLocale(typeof sp.lang === "string" ? sp.lang : null);

  const map = await getPublicCampusByToken(token);
  if (!map) notFound();

  const scene = (map.sceneData ?? {}) as { branding?: CampusBranding };
  const branding = scene.branding ?? {};
  const campusName = branding.name || map.title;
  const accentColor = isValidHex(branding.primaryColor)
    ? branding.primaryColor
    : undefined;
  const themeStyle = accentColor
    ? ({ ["--brand-primary" as string]: accentColor } as React.CSSProperties)
    : undefined;

  const lang = `?lang=${locale}`;
  const mapHref = `/campus/${token}/map${lang}`;
  // DB-backed events + any ICS feeds the admin configured. The DB
  // rows are seeded into SWR's cache via `EventsListClient`'s
  // `initialDbEvents`; ICS rows stay server-side (slow external
  // fetch) and are merged on every client render.
  const feedUrls = readEventFeeds(map.sceneData);
  const [dbEvents, icsEvents] = await Promise.all([
    listUpcomingEventsForProject(map.id, 100),
    feedUrls.length > 0
      ? fetchCampusEvents(feedUrls).catch((err): CampusEvent[] => {
          console.error("[events page] ICS fetch failed", err);
          return [];
        })
      : Promise.resolve<CampusEvent[]>([]),
  ]);

  return (
    <main id="main" data-consumer lang={locale} style={themeStyle}>

      <section className="mx-auto max-w-[1280px] px-4 py-8 md:px-6 md:py-12">
        <h1 className="text-3xl font-medium text-[var(--brand-text)]">
          Explore
        </h1>
        <SegmentedTabs
          token={token}
          lang={lang}
          locale={locale}
          active="events"
        />
        <p className="mt-4 text-sm text-[var(--brand-text-muted)]">
          What’s happening this week and beyond on campus.
        </p>

        <EventsListClient
          token={token}
          locale={locale}
          lang={lang}
          mapHref={mapHref}
          initialDbEvents={dbEvents}
          icsEvents={icsEvents}
          emptyCopy="No events published yet."
        />

        <Link
          href={mapHref}
          className="mt-10 inline-flex items-center gap-2 text-sm font-medium text-[var(--brand-primary)] transition-opacity hover:opacity-80"
        >
          <Compass size={16} strokeWidth={1.75} />
          Open the campus map
        </Link>
      </section>

      <ConsumerFooter campusName={campusName} />
    </main>
  );
}
