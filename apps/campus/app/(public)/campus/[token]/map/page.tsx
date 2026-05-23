import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { venueForIndoorMap } from "@/lib/mappedin/config";
import { MappedinViewer } from "@/lib/mappedin/MappedinViewer";
import PublicViewerClient from "../PublicViewerClient";
import NotPublishedPlaceholder from "../NotPublishedPlaceholder";

type Params = Promise<{ token: string }>;
type Search = Promise<{ space?: string | string[] }>;

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

  const map = await prisma.project
    .findUnique({
      where: { id: token },
      select: { id: true, title: true, isPublished: true, sceneData: true },
    })
    .catch(() => null);

  if (!map) notFound();
  if (!map.isPublished) return <NotPublishedPlaceholder name={map.title} />;

  const indoorMapId = (map.sceneData as { indoorMapId?: string } | null)
    ?.indoorMapId;

  if (indoorMapId) {
    return (
      <main data-mappedin className="h-screen w-full">
        <MappedinViewer
          venue={venueForIndoorMap(indoorMapId)}
          focusSpaceId={focusSpaceId}
        />
      </main>
    );
  }

  return <PublicViewerClient mapId={token} />;
}
