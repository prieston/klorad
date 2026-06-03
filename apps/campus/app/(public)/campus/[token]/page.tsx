import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicCampusByToken } from "@/lib/public-campus";
import { readHomePage } from "@/lib/home-page";
import {
  detectLocale,
  pickDefaultLocale,
  pickLocalized,
  pickText,
} from "@/app/lib/i18n-core";
import { readPosts } from "@/lib/posts";
import { listNewsForProject, type NewsPost } from "@/lib/news";
import {
  listUpcomingEventsForProject,
  type EventPost,
} from "@/lib/events-db";
import { listTopClubsForProject, type Club } from "@/lib/clubs-db";
import { listDiningForProject, type DiningLocation } from "@/lib/dining-db";
import { openNowStatus } from "@/lib/dining-hours";
import { readEventFeeds, type CampusEvent } from "@/lib/events";
import { fetchCampusEvents } from "@/lib/events-server";
import { mergeEvents } from "@/lib/events-merge";
import NotPublishedPlaceholder from "./NotPublishedPlaceholder";
import { ConsumerHome } from "@/lib/consumer/ConsumerHome";
import type {
  ConsumerClub,
  ConsumerDining,
  ConsumerNews,
} from "@/lib/consumer/types";

type Params = Promise<{ token: string }>;

interface CampusBranding {
  name?: string;
  logo?: string;
  primaryColor?: string;
}

function isValidHex(value: string | undefined): value is string {
  return !!value && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}

/** Dynamic metadata so shared URLs preview nicely. */
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
  const description = `${name} — news, events, clubs and an interactive campus map.`;
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
 * Arc 1 of [[campus-consumer-pivot]]: the multi-tenant template
 * lands here. Everything visible is now rendered by `ConsumerHome`;
 * per-org `branding.primaryColor` flows in as `accentColor` and
 * overrides the default purple at the `data-consumer` root.
 *
 * Real news / events / clubs land in Arcs 2 – 4. For now the rails
 * are populated by `lib/sample-campus.ts`, shaped to the eventual
 * schema so the markup doesn't change when data sources flip.
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

  const map = await getPublicCampusByToken(token);
  if (!map) notFound();
  const scene = (map.sceneData ?? {}) as {
    branding?: CampusBranding;
    defaultLocale?: unknown;
  };
  // URL wins; tenant default applies only when the visitor hasn't
  // picked. The campus Settings screen writes `defaultLocale`.
  const locale = detectLocale(
    typeof sp.lang === "string" ? sp.lang : null,
    pickDefaultLocale(scene.defaultLocale),
  );
  if (!map.isPublished)
    return <NotPublishedPlaceholder name={map.title} locale={locale} />;
  const branding = scene.branding ?? {};
  const campusName = branding.name || map.title;
  const accentColor = isValidHex(branding.primaryColor)
    ? branding.primaryColor
    : undefined;
  // The home-page builder lets an org override the marketing copy.
  // When set, those win over the platform's defaults.
  const home = readHomePage(map.sceneData);
  const headline = pickText(home.headline, locale) || undefined;
  const subheading = pickText(home.tagline, locale) || undefined;

  // News rail: combine the new `NewsPost` rows with legacy posts in
  // `sceneData.posts` so existing tenants don't lose what's there
  // while they migrate. Newest first, capped at 6.
  // Events rail: DB events only for now — ICS-feed-sourced events
  // continue to render through `events-server.ts` but are wired into
  // the consumer surface in a follow-up commit (Arc 3 follow-up).
  //
  // Guarded against pending migrations / DB unavailability: if the
  // `NewsPost` or `EventPost` table is missing (operator hasn't run
  // `prisma migrate deploy` yet) the home renders with empty rails
  // + the sample-data fallback in `ConsumerHome` instead of 500ing.
  const feedUrls = readEventFeeds(map.sceneData);
  const [dbPosts, dbEvents, dbClubs, dbDining, icsEvents] = await Promise.all([
    listNewsForProject(map.id).catch((err): NewsPost[] => {
      console.error("[public-home] news fetch failed", err);
      return [];
    }),
    listUpcomingEventsForProject(map.id, 12).catch((err): EventPost[] => {
      console.error("[public-home] events fetch failed", err);
      return [];
    }),
    listTopClubsForProject(map.id, 6).catch((err): Club[] => {
      console.error("[public-home] clubs fetch failed", err);
      return [];
    }),
    listDiningForProject(map.id).catch((err): DiningLocation[] => {
      console.error("[public-home] dining fetch failed", err);
      return [];
    }),
    feedUrls.length > 0
      ? fetchCampusEvents(feedUrls).catch((err): CampusEvent[] => {
          console.error("[public-home] ICS fetch failed", err);
          return [];
        })
      : Promise.resolve<CampusEvent[]>([]),
  ]);
  const legacyPosts = readPosts(map.sceneData);
  const news: ConsumerNews[] = [
    ...dbPosts.map((p) => {
      const title = pickLocalized(p.title, p.titleEl, locale);
      const bodyLocalised = pickLocalized(p.body, p.bodyEl, locale);
      return {
        id: p.id,
        title,
        excerpt:
          bodyLocalised.length > 200
            ? `${bodyLocalised.slice(0, 197)}…`
            : bodyLocalised,
        category: p.category,
        publishedAt: p.publishedAt,
        anchors: p.anchors.map((a) => ({
          kind: a.kind,
          refId: a.refId,
          refName: a.refName,
        })),
      };
    }),
    ...legacyPosts.map((p) => {
      const title = pickText(p.title, locale) || "";
      const bodyText = pickText(p.body, locale) || "";
      return {
        id: p.id,
        title,
        excerpt:
          bodyText.length > 200 ? `${bodyText.slice(0, 197)}…` : bodyText,
        category: "news" as const,
        publishedAt: p.publishedAt,
        anchors: p.place
          ? [
              {
                // Legacy "floor" is collapsed to "building" — the new
                // model doesn't carry a floor anchor kind.
                kind: (p.place.kind === "room" ? "room" : "building") as
                  | "room"
                  | "building",
                refId: p.place.id,
                refName: p.place.name,
              },
            ]
          : [],
      };
    }),
  ]
    .sort(
      (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
    )
    .slice(0, 6);

  // Club rows map 1:1 onto the consumer rail shape — `avatarColor`
  // is the same union and the public rail honours an empty external
  // link (View pill hides). Without externalLink, the consumer can
  // still click through to the club's detail page in-app.
  const clubs: ConsumerClub[] = dbClubs.map((c) => ({
    id: c.id,
    name: pickLocalized(c.name, c.nameEl, locale),
    initials: c.initials,
    avatarColor: c.avatarColor,
    memberCount: c.memberCount,
    meetsCadence: c.meetsCadence ?? "",
    externalLink: c.externalLink ?? "",
  }));

  // Dining rows for the "Dining now" rail — name + status pair.
  // Structured `hours` (when set) drives a real "Open now" / "Opens
  // 17:00" status; otherwise we fall back to the free-text caveat or
  // the cuisine label.
  const now = new Date();
  const dining: ConsumerDining[] = dbDining.map((d) => {
    const status = openNowStatus(d.hours, now);
    const statusCopy = locale === "el" ? status.labelEl : status.label;
    return {
      id: d.id,
      name: pickLocalized(d.name, d.nameEl, locale),
      status: statusCopy || d.hoursText || d.cuisine || "",
    };
  });

  // Merge DB events + ICS-feed events into one list — soonest first,
  // dupes (same title + minute) collapsed. `eventPostToConsumer` and
  // `icsToConsumer` share the mapping logic in `events-merge.ts`.
  // Localise titles + blurbs on the DB rows before they meet
  // `mergeEvents`. ICS rows have no EL columns to pick from.
  const dbEventsLocalised = dbEvents.map((e) => ({
    ...e,
    title: pickLocalized(e.title, e.titleEl, locale),
    description: pickLocalized(e.description, e.descriptionEl, locale),
  }));
  const events = mergeEvents(dbEventsLocalised, icsEvents, 24);

  return (
    <ConsumerHome
      token={token}
      mapId={map.id}
      campusName={campusName}
      accentColor={accentColor}
      logoUrl={branding.logo}
      locale={locale}
      headline={headline}
      subheading={subheading}
      mapThumbnailUrl={map.thumbnail ?? undefined}
      heroImageUrl={home.heroImage ?? map.thumbnail ?? undefined}
      news={news}
      events={events}
      clubs={clubs}
      dining={dining}
    />
  );
}
