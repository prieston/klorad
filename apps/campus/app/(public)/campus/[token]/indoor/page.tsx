import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { venueForIndoorMap } from "@/lib/mappedin/config";
import { MappedinViewer } from "@/lib/mappedin/MappedinViewer";
import NotPublishedPlaceholder from "../NotPublishedPlaceholder";

type Params = Promise<{ token: string }>;
type Search = Promise<{ space?: string | string[] }>;

/**
 * `/campus/[token]/indoor` — the campus's public MappedIn viewer.
 *
 * The campus-specific counterpart to the account-wide `/indoor`
 * route: it resolves this campus's own `indoorMapId`. A `?space=`
 * param deep-links straight to a room — news posts linked to a
 * MappedIn space point here.
 */
export default async function CampusIndoorPage({
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
  if (!indoorMapId) {
    return (
      <main className="flex h-screen items-center justify-center bg-bg p-8 text-center">
        <p className="text-sm text-text-tertiary">
          This campus doesn’t have an indoor map yet.
        </p>
      </main>
    );
  }

  return (
    <main data-mappedin className="h-screen w-full">
      <MappedinViewer
        venue={venueForIndoorMap(indoorMapId)}
        focusSpaceId={focusSpaceId}
      />
    </main>
  );
}
