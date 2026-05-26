import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, MapPin, Compass, ExternalLink } from "lucide-react";
import { getPublicCampusByToken } from "@/lib/public-campus";
import { detectLocale } from "@/app/lib/i18n-core";
import {
  formatEventWhen,
  getEventPost,
} from "@/lib/events-db";
import { ConsumerNav } from "@/lib/consumer/ConsumerNav";
import { ConsumerFooter } from "@/lib/consumer/ConsumerFooter";

type Params = Promise<{ token: string; id: string }>;

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
 * Hero image (if any), title, when, organizer + expected attendance,
 * anchor chips that deep-link into the MappedIn viewer, description,
 * and the primary "Get directions" CTA that drops onto the map
 * focused on the event's anchor. Optional "Register" link opens the
 * organiser's URL in a new tab.
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
  const locale = detectLocale(typeof sp.lang === "string" ? sp.lang : null);

  const map = await getPublicCampusByToken(token);
  if (!map) notFound();
  const event = await getEventPost(id);
  if (!event || event.projectId !== map.id) notFound();

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
  const firstAnchor = event.anchors[0];
  // Anchor with a refId → drop onto the map focused on that space.
  // Without a refId we still link to the map (the visitor can search).
  const directionsHref = firstAnchor?.refId
    ? `${mapHref}&space=${encodeURIComponent(firstAnchor.refId)}`
    : mapHref;

  return (
    <main data-consumer lang={locale} style={themeStyle}>
      <ConsumerNav
        campusName={campusName}
        logoUrl={branding.logo}
        token={token}
        locale={locale}
      />

      <article className="mx-auto max-w-[760px] px-4 py-8 md:px-6 md:py-12">
        <Link
          href={`/campus/${token}${lang}`}
          className="inline-flex items-center gap-1 text-sm text-[var(--brand-text-muted)] transition-colors hover:text-[var(--brand-primary)]"
        >
          <ChevronLeft size={16} strokeWidth={1.75} />
          Back to {campusName}
        </Link>

        {event.imageUrl ? (
          <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--brand-line)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={event.imageUrl}
              alt=""
              className="block aspect-[16/9] w-full object-cover"
            />
          </div>
        ) : null}

        <h1 className="mt-8 text-3xl font-medium leading-tight text-[var(--brand-text)] md:text-4xl">
          {event.title}
        </h1>

        <p className="mt-3 text-sm text-[var(--brand-text-muted)]">
          {formatEventWhen(event.startsAt)}
          {event.organizer ? ` · ${event.organizer}` : ""}
          {event.expectedAttendance
            ? ` · ${event.expectedAttendance} going`
            : ""}
        </p>

        {event.anchors.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {event.anchors.map((a, i) =>
              a.refId ? (
                <Link
                  key={`${a.refId}-${i}`}
                  href={`${mapHref}&space=${encodeURIComponent(a.refId)}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-primary-bg)] px-3 py-1 text-xs font-medium text-[var(--brand-primary)] transition-opacity hover:opacity-80"
                >
                  <MapPin size={14} strokeWidth={1.75} />
                  {a.refName}
                </Link>
              ) : (
                <span
                  key={`${a.refName}-${i}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-primary-bg)] px-3 py-1 text-xs font-medium text-[var(--brand-primary)]"
                >
                  <MapPin size={14} strokeWidth={1.75} />
                  {a.refName}
                </span>
              ),
            )}
          </div>
        ) : null}

        <div className="mt-8 whitespace-pre-wrap text-base leading-relaxed text-[var(--brand-text)]">
          {event.description}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={directionsHref}
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--brand-primary)" }}
          >
            <Compass size={16} strokeWidth={1.75} />
            Get directions
          </Link>
          {event.registrationUrl ? (
            <a
              href={event.registrationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-line)] bg-white px-5 py-2.5 text-sm font-medium text-[var(--brand-text)] transition-colors hover:border-[var(--brand-primary)]"
            >
              <ExternalLink size={16} strokeWidth={1.75} />
              Register
            </a>
          ) : null}
        </div>
      </article>

      <ConsumerFooter campusName={campusName} />
    </main>
  );
}
