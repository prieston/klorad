import { resolveVenue } from "@/lib/mappedin/config";
import { MappedinViewer } from "@/lib/mappedin/MappedinViewer";

export const metadata = {
  title: "Indoor map · Klorad Campus",
};

/**
 * `/indoor` — the MappedIn-powered indoor viewer.
 *
 * A standalone, full-bleed route: it gets only the root layout, so no
 * dashboard chrome. Renders the venue from `resolveVenue()` (the
 * public demo venue until `NEXT_PUBLIC_MAPPEDIN_*` is set).
 *
 * This route + `lib/mappedin/` are the entire MappedIn surface — the
 * rest of the app is untouched.
 */
export default function IndoorPage() {
  return (
    <main data-mappedin className="h-screen w-full">
      <MappedinViewer venue={resolveVenue()} />
    </main>
  );
}
