import { Compass, LayoutGrid, MapPin, Sparkles } from "lucide-react";
import type { Locale } from "@/app/lib/i18n-core";
import { ConsumerNav } from "./ConsumerNav";
import { GreetingCard } from "./GreetingCard";
import { HomeTile } from "./HomeTile";
import { EventCard } from "./EventCard";
import { DiningRow } from "./DiningRow";
import { ConsumerFooter } from "./ConsumerFooter";
import { NotificationButton } from "./NotificationButton";
import { SAMPLE_EVENTS } from "../sample-campus";
import type {
  ConsumerClub,
  ConsumerDining,
  ConsumerEvent,
  ConsumerNews,
} from "./types";

export interface ConsumerHomeProps {
  token: string;
  /** Project id — used by the chat for DB queries (`mapId` in the API). */
  mapId: string;
  campusName: string;
  /** Per-org accent — overrides `--brand-primary` for the whole page. */
  accentColor?: string;
  logoUrl?: string;
  locale: Locale;
  /** Optional org-set hero copy — unused in the new mobile layout but
   *  kept on the props so the home `page.tsx` can keep passing it
   *  while the schema settles. */
  headline?: string;
  subheading?: string;
  /** Real venue thumbnail — currently unused; kept for future hero variants. */
  mapThumbnailUrl?: string;
  /** Background image painted behind the greeting hero. Falls back
   *  via the home page (`sceneData.homePage.heroImage` → `thumbnail`). */
  heroImageUrl?: string;
  /** Optional rails — drive the **Happening today** + **Dining now** sections. */
  events?: ConsumerEvent[];
  /** Kept for prop-compat with the home page; unused since clubs live in Explore now. */
  clubs?: ConsumerClub[];
  /** Kept for prop-compat; news lives in Explore now. */
  news?: ConsumerNews[];
  /** Dining locations for the "Dining now" rail. */
  dining?: ConsumerDining[];
  /** VAPID public key — when set, renders the Get-notifications button. */
  vapidPublicKey?: string;
}

const COPY = {
  en: {
    tileFindRoom: "Find a room",
    tileDirections: "Directions",
    tileKlio: "Ask Klio",
    tileExplore: "What's on",
    happeningToday: "Happening today",
    diningNow: "Dining now",
    seeAll: "See all",
    nothingToday: "Nothing scheduled today.",
    noDining: "No dining published yet.",
  },
  el: {
    tileFindRoom: "Βρες χώρο",
    tileDirections: "Οδηγίες",
    tileKlio: "Ρώτα την Κλειώ",
    tileExplore: "Τι παίζει",
    happeningToday: "Σήμερα στην πανεπιστημιούπολη",
    diningNow: "Φαγητό τώρα",
    seeAll: "Όλα",
    nothingToday: "Δεν έχει προγραμματισμένα σήμερα.",
    noDining: "Δεν έχει δημοσιευτεί χώρος εστίασης ακόμα.",
  },
} as const;

/**
 * Filter events that start today (visitor's local clock, computed at
 * render). Falls back to the next N events when nothing is scheduled
 * for today so the rail never reads as empty for a healthy campus.
 */
function selectTodayEvents(events: ConsumerEvent[]): ConsumerEvent[] {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  const today = events.filter((e) => {
    const t = Date.parse(e.startsAt);
    if (Number.isNaN(t)) return false;
    return t >= start.getTime() && t <= end.getTime();
  });
  return today.length > 0 ? today.slice(0, 2) : events.slice(0, 2);
}

/**
 * Mobile-first consumer home.
 *
 * Bands top-to-bottom: nav · friendly greeting card with a Klio
 * search affordance · 4-up action grid (Find a room, Directions,
 * Ask Klio, What's on) · Happening today (max 2 event cards) ·
 * Dining now (max 2 rows) · footer.
 *
 * News and Clubs no longer live on the home — both now sit inside
 * the Explore tab so the home stays intent-driven (act on something)
 * rather than browse-driven (read a feed).
 */
export function ConsumerHome({
  token,
  mapId,
  campusName,
  accentColor,
  logoUrl,
  locale,
  events,
  dining,
  heroImageUrl,
  vapidPublicKey,
}: ConsumerHomeProps) {
  const copy = COPY[locale];
  const eventItems = events?.length ? events : SAMPLE_EVENTS;
  const todayEvents = selectTodayEvents(eventItems);
  const diningItems = dining ?? [];
  const lang = `?lang=${locale}`;
  const mapHref = `/campus/${token}/map${lang}`;
  // Directions tile lands on the map in route mode with the picker
  // pre-opened for the destination; `from=` defaults to GPS via
  // `YOUR_LOCATION_ID`.
  const directionsHref = `/campus/${token}/map?route=1&lang=${locale}`;
  const klioHref = `/campus/${token}/klio${lang}`;
  const exploreHref = `/campus/${token}/explore${lang}`;
  const diningHref = `/campus/${token}/dining${lang}`;
  const eventsHref = `/campus/${token}/events${lang}`;

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

      <GreetingCard
        klioHref={klioHref}
        locale={locale}
        backgroundImageUrl={heroImageUrl}
      />

      {/* Bell + 4 action tiles. */}
      <section className="mx-auto mt-6 max-w-[1280px] px-4 md:px-6">
        <div className="flex items-center justify-end pb-3">
          <NotificationButton mapId={mapId} vapidPublicKey={vapidPublicKey} />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <HomeTile
            href={mapHref}
            icon={MapPin}
            accent="cool"
            label={copy.tileFindRoom}
          />
          <HomeTile
            href={directionsHref}
            icon={Compass}
            accent="complement"
            label={copy.tileDirections}
          />
          <HomeTile
            href={klioHref}
            icon={Sparkles}
            label={copy.tileKlio}
            variant="primary"
          />
          <HomeTile
            href={exploreHref}
            icon={LayoutGrid}
            accent="warm"
            label={copy.tileExplore}
          />
        </div>
      </section>

      {/* Happening today. */}
      <section className="mx-auto mt-10 max-w-[1280px] px-4 md:px-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-[var(--brand-text)]">
            {copy.happeningToday}
          </h2>
          <a
            href={eventsHref}
            className="text-sm font-medium text-[var(--brand-primary)] hover:underline"
          >
            {copy.seeAll}
          </a>
        </div>
        {todayEvents.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-[var(--brand-line)] bg-white p-4 text-sm text-[var(--brand-text-muted)]">
            {copy.nothingToday}
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
            {todayEvents.map((e) => {
              const isIcs = e.id.includes("::");
              const firstAnchor = e.anchors[0];
              const href = isIcs
                ? firstAnchor?.refId
                  ? `${mapHref}&space=${encodeURIComponent(firstAnchor.refId)}`
                  : eventsHref
                : `/campus/${token}/events/${e.id}${lang}`;
              return (
                <EventCard
                  key={e.id}
                  event={e}
                  href={href}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* Dining now. */}
      <section className="mx-auto mt-10 max-w-[1280px] px-4 md:px-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-[var(--brand-text)]">
            {copy.diningNow}
          </h2>
          <a
            href={diningHref}
            className="text-sm font-medium text-[var(--brand-primary)] hover:underline"
          >
            {copy.seeAll}
          </a>
        </div>
        {diningItems.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-[var(--brand-line)] bg-white p-4 text-sm text-[var(--brand-text-muted)]">
            {copy.noDining}
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            {diningItems.slice(0, 2).map((d) => (
              <DiningRow
                key={d.id}
                name={d.name}
                status={d.status}
                href={diningHref}
              />
            ))}
          </div>
        )}
      </section>

      <ConsumerFooter campusName={campusName} />
    </main>
  );
}
