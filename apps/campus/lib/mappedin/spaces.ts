import type { MappedinVenue } from "./config";
import type { PostPlace } from "@/lib/posts";

/** Display row for the news / events anchor pickers. Mirrors the old
 *  `PlaceOption` shape that lived in the now-deleted `lib/places.ts`
 *  scene-graph helper — only the type travels with us, the runtime
 *  helper went away with the Workbench. */
export interface PlaceOption extends PostPlace {
  label: string;
}

/**
 * Load a MappedIn venue's named spaces as place options for the news
 * linked-place picker. The SDK is dynamically imported so it never
 * reaches the server bundle.
 *
 * Used when a campus's indoor map is MappedIn — then the rooms a post
 * should link to are MappedIn spaces, not the workbench scene.
 */
export async function loadMappedinSpaces(
  venue: MappedinVenue,
): Promise<PlaceOption[]> {
  const { getMapData } = await import("@mappedin/mappedin-js");
  const mapData = await getMapData({
    key: venue.key,
    secret: venue.secret,
    mapId: venue.mapId,
  });
  return mapData
    .getByType("space")
    .filter((s) => s.name)
    .map((s) => {
      const name = s.name as string;
      return {
        id: s.id,
        kind: "room" as const,
        name,
        source: "mappedin" as const,
        label: name,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
