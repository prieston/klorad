import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarPlus,
  ChevronLeft,
  Compass,
  ExternalLink,
  MapPin,
} from "lucide-react";
import { getPublicCampusByToken } from "@/lib/public-campus";
import {
  detectLocale,
  pickDefaultLocale,
  pickLocalized,
} from "@/app/lib/i18n-core";
import {
  formatEventWhen,
  getEventPost,
} from "@/lib/events-db";
import type { AccentName } from "@/lib/consumer/types";
import { ConsumerFooter } from "@/lib/consumer/ConsumerFooter";
import { stripedBanner } from "@/lib/consumer/bannerPattern";
import { googleCalendarHref } from "@/lib/consumer/addToCalendar";

type Params = Promise<{ token: string; id: string }>;

interface CampusBranding {
  name?: string;
  logo?: string;
  primaryColor?: string;
}

/** Map the event banner colour to a palette CSS var. */
const BANNER_ACCENT: Record<AccentName, string> = {
  purple: "var(--brand-primary-fill)",
  coral: "var(--brand-accent-warm)",
  teal: "var(--brand-accent-cool)",
  pink: "var(--brand-accent-complement)",
};

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { token, id } = await params;
  const [map, event] = await Promise.all([
    getPublicCampusByToken(token),
    getEventPost(id),
  ]);
  if (!event || !map || event.projectId !== map.id) return { title: "Event" };
  return {
    title: `${event.title} · Events`,
    description: event.description.slice(0, 160),
    openGraph: {
      title: event.title,
      description: event.description.slice(0, 160),
      type: "article",
      images: event.imageUrl ? [event.imageUrl] : undefined,
    },
  };
}

/**
 * `/campus/[token]/events/[id]` — public event detail.
 *
 * Layout mirrors the mobile-first mockup: striped cover area on top
 * (the event's image, when set, sits behind the brand-coloured
 * stripes), back chevron floating in a chip, then a content card
 * that lifts above the cover with `rounded-t-3xl`. Body, an anchor
 * card with a "Route here" button, and a primary "Add to calendar"
 * CTA at the bottom.
 */
export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token, id } = await params;
  const sp = await searchParams;
  const map = await getPublicCampusByToken(token);
  if (!map) notFound();
  const event = await getEventPost(id);
  if (!event || event.projectId !== map.id) notFound();

  const scene = (map.sceneData ?? {}) as {
    branding?: CampusBranding;
    defaultLocale?: unknown;
  };
  const locale = detectLocale(
    typeof sp.lang === "string" ? sp.lang : null,
    pickDefaultLocale(scene.defaultLocale),
  );
  const branding = scene.branding ?? {};
  const campusName = branding.name || map.title;

  const lang = `?lang=${locale}`;
  const mapHref = `/campus/${token}/map${lang}`;
  const title = pickLocalized(event.title, event.titleEl, locale);
  const description = pickLocalized(
    event.description,
    event.descriptionEl,
    locale,
  );
  const firstAnchor = event.anchors[0];
  const directionsHref = firstAnchor?.refId
    ? `${mapHref}&space=${encodeURIComponent(firstAnchor.refId)}`
    : mapHref;
  const accent =
    BANNER_ACCENT[event.bannerColor as AccentName] ??
    "var(--brand-primary-fill)";
  const calendarHref = googleCalendarHref({
    title,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    location: firstAnchor
      ? `${firstAnchor.refName}${campusName ? ` · ${campusName}` : ""}`
      : campusName,
    details: description.slice(0, 500),
  });

  return (
    <main id="main" data-consumer lang={locale}>

      <article className="mx-auto max-w-[760px]">
        {/* Striped cover + optional event image. */}
        <div
          className="relative h-56 w-full md:h-72"
          style={{
            ...stripedBanner(accent, 22),
            ...(event.imageUrl
              ? {
                  backgroundImage: `url(${event.imageUrl}), ${
                    (stripedBanner(accent, 22) as { backgroundImage: string })
                      .backgroundImage
                  }`,
                  backgroundSize: "cover, auto",
                  backgroundPosition: "center, top left",
                  backgroundBlendMode: "soft-light, normal",
                }
              : null),
          }}
        >
          <Link
            href={`/campus/${token}${lang}`}
            aria-label={`Back to ${campusName}`}
            className="absolute left-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-[var(--brand-text)] shadow-sm transition-colors hover:text-[var(--brand-primary)]"
          >
            <ChevronLeft size={18} strokeWidth={2} />
          </Link>
        </div>

        <div className="relative -mt-10 rounded-t-[2rem] bg-white px-5 pt-8 pb-10 shadow-[0_-12px_24px_-16px_rgba(0,0,0,0.08)] md:px-8 md:pt-10">
          <div className="flex items-center gap-3">
            <span
              className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-white"
              style={{ backgroundColor: accent }}
            >
              {event.bannerIcon === "music"
                ? "Music"
                : event.bannerIcon === "trophy"
                  ? "Sport"
                  : event.bannerIcon === "sprout"
                    ? "Outdoor"
                    : "Event"}
            </span>
            <span className="text-xs text-[var(--brand-text-muted)]">
              {formatEventWhen(event.startsAt)}
              {event.organizer ? ` · ${event.organizer}` : ""}
            </span>
          </div>

          <h1 className="mt-4 text-3xl font-semibold leading-tight text-[var(--brand-text)] md:text-4xl">
            {title}
          </h1>

          <div className="mt-5 whitespace-pre-wrap text-base leading-relaxed text-[var(--brand-text)]">
            {description}
          </div>

          {firstAnchor ? (
            <div className="mt-6 flex items-center gap-3 rounded-2xl bg-[var(--brand-page)] p-3 md:p-4">
              <span
                aria-hidden
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
                style={{ backgroundColor: accent }}
              >
                <MapPin size={18} strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-[var(--brand-text)]">
                  {firstAnchor.refName}
                </div>
                {event.organizer ? (
                  <div className="truncate text-xs text-[var(--brand-text-muted)]">
                    {event.organizer}
                  </div>
                ) : null}
              </div>
              <Link
                href={directionsHref}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--brand-primary-bg)] px-3 py-2 text-xs font-semibold text-[var(--brand-primary)] transition-opacity hover:opacity-80"
              >
                <Compass size={14} strokeWidth={2} />
                Route here
              </Link>
            </div>
          ) : null}

          <div className="mt-6 flex flex-col gap-3">
            <a
              href={calendarHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--brand-primary)" }}
            >
              <CalendarPlus size={16} strokeWidth={2} />
              Add to calendar
            </a>
            {event.registrationUrl ? (
              <a
                href={event.registrationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[var(--brand-line)] bg-white px-5 py-3 text-sm font-medium text-[var(--brand-text)] transition-colors hover:border-[var(--brand-primary)]"
              >
                <ExternalLink size={16} strokeWidth={1.75} />
                Register
              </a>
            ) : null}
          </div>
        </div>
      </article>

      <ConsumerFooter campusName={campusName} />
    </main>
  );
}
