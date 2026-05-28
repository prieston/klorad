import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, Compass, MapPin } from "lucide-react";
import { getPublicCampusByToken } from "@/lib/public-campus";
import { detectLocale } from "@/app/lib/i18n-core";
import {
  formatEventWhen,
  listUpcomingEventsForProject,
} from "@/lib/events-db";
import { ConsumerNav } from "@/lib/consumer/ConsumerNav";
import { ConsumerFooter } from "@/lib/consumer/ConsumerFooter";

type Params = Promise<{ token: string }>;

interface CampusBranding {
  name?: string;
  logo?: string;
  primaryColor?: string;
}

function isValidHex(value: string | undefined): value is string {
  return !!value && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}

const BANNER_BG: Record<string, string> = {
  purple: "var(--brand-primary)",
  coral: "#D85A30",
  teal: "#1D9E75",
  pink: "#D4537E",
};

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
  const events = await listUpcomingEventsForProject(map.id, 50);

  return (
    <main data-consumer lang={locale} style={themeStyle}>
      <ConsumerNav
        campusName={campusName}
        logoUrl={branding.logo}
        token={token}
        locale={locale}
      />

      <section className="mx-auto max-w-[1280px] px-4 py-8 md:px-6 md:py-12">
        <h1 className="text-3xl font-medium text-[var(--brand-text)]">
          Events
        </h1>
        <p className="mt-2 text-sm text-[var(--brand-text-muted)]">
          What’s happening this week and beyond on campus.
        </p>

        {events.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-[var(--brand-line)] bg-white p-8 text-center text-sm text-[var(--brand-text-muted)]">
            No events published yet.
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {events.map((e) => {
              const firstAnchor = e.anchors[0];
              return (
                <Link
                  key={e.id}
                  href={`/campus/${token}/events/${e.id}${lang}`}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--brand-line)] bg-white transition-colors hover:border-[var(--brand-primary)]"
                >
                  <div
                    className="flex h-20 items-end justify-start p-4"
                    style={{
                      backgroundColor: BANNER_BG[e.bannerColor] ?? "#534AB7",
                    }}
                  >
                    <Calendar
                      size={24}
                      strokeWidth={1.5}
                      className="text-white"
                      aria-hidden
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-5">
                    <h2 className="text-base font-medium text-[var(--brand-text)]">
                      {e.title}
                    </h2>
                    <span className="text-xs text-[var(--brand-text-muted)]">
                      {formatEventWhen(e.startsAt)}
                    </span>
                    <p className="line-clamp-2 text-xs leading-relaxed text-[var(--brand-text-muted)]">
                      {e.description}
                    </p>
                    <div className="mt-auto flex flex-wrap items-center gap-2 pt-2 text-xs text-[var(--brand-text-muted)]">
                      {firstAnchor ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={14} strokeWidth={1.75} />
                          {firstAnchor.refName}
                        </span>
                      ) : null}
                      {firstAnchor?.refId ? (
                        <span className="ml-auto inline-flex items-center gap-1 text-[var(--brand-primary)] group-hover:underline">
                          <Compass size={14} strokeWidth={1.75} />
                          Directions
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

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
