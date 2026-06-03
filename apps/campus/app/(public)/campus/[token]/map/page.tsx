import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";
import { getPublicCampusByToken } from "@/lib/public-campus";
import { venueForIndoorMap } from "@/lib/mappedin/config";
import {
  detectLocale,
  pickDefaultLocale,
  translate,
} from "@/app/lib/i18n-core";
import NotPublishedPlaceholder from "../NotPublishedPlaceholder";
import { MapPageClient } from "./MapPageClient";

type Params = Promise<{ token: string }>;
type Search = Promise<{
  space?: string | string[];
  lang?: string | string[];
}>;

/**
 * `/campus/[token]/map` — the campus map page.
 *
 * Layout: ConsumerNav on top → sticky search chip → MappedIn viewer
 * in a rounded card (bounded height so the buildings list shows
 * below the fold) → up-front Buildings list. Per-tenant brand
 * colours cascade from the layout wrapper.
 */
export default async function CampusMapPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const focusSpaceId = typeof sp.space === "string" ? sp.space : undefined;

  const map = await getPublicCampusByToken(token);

  if (!map) notFound();
  const scene = (map.sceneData ?? null) as {
    indoorMapId?: string;
    branding?: { primaryColor?: string; name?: string; logo?: string };
    defaultLocale?: unknown;
  } | null;
  const locale = detectLocale(
    typeof sp.lang === "string" ? sp.lang : null,
    pickDefaultLocale(scene?.defaultLocale),
  );
  if (!map.isPublished)
    return <NotPublishedPlaceholder name={map.title} locale={locale} />;
  const indoorMapId = scene?.indoorMapId;
  const accentColor =
    scene?.branding?.primaryColor &&
    /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(scene.branding.primaryColor)
      ? scene.branding.primaryColor
      : undefined;
  const campusName = scene?.branding?.name || map.title;

  if (indoorMapId) {
    const lang = `?lang=${locale}`;
    return (
      <main
        id="main"
        data-mappedin
        lang={locale}
        // 3.5rem = layout ConsumerNav (h-14). Subtract so the
        // viewer fills the remaining viewport instead of pushing
        // the bottom nav off-screen.
        className="flex h-[calc(100dvh-3.5rem)] w-full flex-col"
      >
        <MapPageClient
          venue={venueForIndoorMap(indoorMapId)}
          focusSpaceId={focusSpaceId}
          locale={locale}
          homeHref={`/campus/${token}${lang}`}
          accentColor={accentColor}
          projectId={map.id}
          campusName={campusName}
          klioHref={`/campus/${token}/klio${lang}`}
        />
      </main>
    );
  }

  // No MappedIn venue id configured — render a friendly placeholder
  // instead of falling through to a 3D scene the campus doesn't own.
  // Campus is MappedIn-first per [[campus-indoor-mappedin-decision]];
  // the rector lands here only when they haven't pasted a venue id
  // into Identity yet. Send them home where the rest of the campus
  // (news/events/clubs/dining) still works.
  const lang = `?lang=${locale}`;
  const themeStyle = accentColor
    ? ({ ["--brand-primary" as string]: accentColor } as React.CSSProperties)
    : undefined;
  return (
    <main
      id="main"
      data-consumer
      lang={locale}
      style={themeStyle}
      className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16 text-center"
    >
      <div
        aria-hidden
        className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-primary-bg)] text-[var(--brand-primary)]"
      >
        <Compass size={20} strokeWidth={1.75} />
      </div>
      <h1 className="text-lg font-medium text-[var(--brand-text)]">
        {locale === "el"
          ? "Ο χάρτης δεν είναι ακόμη διαθέσιμος"
          : "The map isn't set up yet"}
      </h1>
      <p className="mt-2 max-w-md text-sm text-[var(--brand-text-muted)]">
        {locale === "el"
          ? `${campusName} δεν έχει συνδέσει χάρτη ακόμη. Επιστρέψτε σε λίγο ή εξερευνήστε τα νέα και τις εκδηλώσεις.`
          : `${campusName} hasn't connected a campus map yet. Check back soon, or browse news and events in the meantime.`}
      </p>
      <Link
        href={`/campus/${token}${lang}`}
        className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        <ArrowLeft size={14} strokeWidth={1.75} aria-hidden />
        {translate(locale, "common.back")}
      </Link>
    </main>
  );
}
