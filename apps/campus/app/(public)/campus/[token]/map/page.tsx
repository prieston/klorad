import { notFound } from "next/navigation";
import { getPublicCampusByToken } from "@/lib/public-campus";
import { venueForIndoorMap } from "@/lib/mappedin/config";
import { detectLocale } from "@/app/lib/i18n-core";
import { ConsumerNav } from "@/lib/consumer/ConsumerNav";
import PublicViewerClient from "../PublicViewerClient";
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
  const locale = detectLocale(typeof sp.lang === "string" ? sp.lang : null);

  const map = await getPublicCampusByToken(token);

  if (!map) notFound();
  if (!map.isPublished)
    return <NotPublishedPlaceholder name={map.title} locale={locale} />;

  const scene = (map.sceneData ?? null) as {
    indoorMapId?: string;
    branding?: { primaryColor?: string; name?: string; logo?: string };
  } | null;
  const indoorMapId = scene?.indoorMapId;
  const accentColor =
    scene?.branding?.primaryColor &&
    /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(scene.branding.primaryColor)
      ? scene.branding.primaryColor
      : undefined;
  const campusName = scene?.branding?.name || map.title;
  const logoUrl = scene?.branding?.logo;

  if (indoorMapId) {
    const lang = `?lang=${locale}`;
    return (
      <main
        data-mappedin
        lang={locale}
        className="flex h-[100dvh] w-full flex-col"
      >
        <ConsumerNav
          campusName={campusName}
          logoUrl={logoUrl}
          token={token}
          locale={locale}
        />
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

  return <PublicViewerClient mapId={token} />;
}
