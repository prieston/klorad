import { notFound } from "next/navigation";
import { getPublicCampusByToken } from "@/lib/public-campus";
import { venueForIndoorMap } from "@/lib/mappedin/config";
import { MappedinViewer } from "@/lib/mappedin/MappedinViewer";
import { detectLocale } from "@/app/lib/i18n-core";
import PublicViewerClient from "../PublicViewerClient";
import NotPublishedPlaceholder from "../NotPublishedPlaceholder";

type Params = Promise<{ token: string }>;
type Search = Promise<{
  space?: string | string[];
  lang?: string | string[];
}>;

/**
 * `/campus/[token]/map` — the campus map.
 *
 * MappedIn is the campus map: a campus with a MappedIn venue
 * (`indoorMapId`) renders the MappedIn viewer — outdoor + indoor in
 * one. A `?space=` param deep-links to a room (news + event links).
 *
 * Campuses without a MappedIn venue fall back to the parked Mapbox
 * viewer. Same `isPublished` gate as the home.
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
    branding?: { primaryColor?: string; name?: string };
  } | null;
  const indoorMapId = scene?.indoorMapId;
  const accentColor =
    scene?.branding?.primaryColor &&
    /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(scene.branding.primaryColor)
      ? scene.branding.primaryColor
      : undefined;
  const campusName = scene?.branding?.name || map.title;

  if (indoorMapId) {
    return (
      <main data-mappedin className="h-screen w-full">
        <MappedinViewer
          venue={venueForIndoorMap(indoorMapId)}
          focusSpaceId={focusSpaceId}
          locale={locale}
          homeHref={`/campus/${token}?lang=${locale}`}
          accentColor={accentColor}
          projectId={map.id}
          campusName={campusName}
          showWelcome
        />
      </main>
    );
  }

  return <PublicViewerClient mapId={token} />;
}
