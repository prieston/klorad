/**
 * MappedIn venue configuration.
 *
 * This is the *only* place MappedIn-specific data lives outside the
 * `MappedinViewer` component. MappedIn powers the indoor viewer for
 * the first sales while we validate the market; when we build the
 * in-house engine, this file and the viewer are the only things that
 * get swapped — nothing else in the app imports the MappedIn SDK.
 *
 * The `key` / `secret` here are *publishable*, browser-side
 * credentials (like a Mapbox token) — the Web SDK authenticates from
 * the client. The defaults below are MappedIn's public demo venue, so
 * the viewer works with no account. Point it at a real customer venue
 * by setting the env vars.
 */
export interface MappedinVenue {
  key: string;
  secret: string;
  mapId: string;
}

/**
 * MappedIn's public demo venue — renders with no account needed.
 * These Maker (`mik_`/`mis_`) demo credentials only work with
 * MappedIn's own demo maps; a real venue needs a Pro/Enterprise
 * account and the `NEXT_PUBLIC_MAPPEDIN_*` env vars.
 */
export const DEMO_VENUE: MappedinVenue = {
  key: "mik_yeBk0Vf0nNJtpesfu560e07e5",
  secret: "mis_2g9ST8ZcSFb5R9fPnsvYhrX3RyRwPtDGbMGweCYKEq385431022",
  mapId: "65c0ff7430b94e3fabd5bb8c",
};

/**
 * Resolve the venue to render. Uses `NEXT_PUBLIC_MAPPEDIN_*` when all
 * three are set (a real customer venue), otherwise the demo venue.
 */
export function resolveVenue(): MappedinVenue {
  const key = process.env.NEXT_PUBLIC_MAPPEDIN_KEY;
  const secret = process.env.NEXT_PUBLIC_MAPPEDIN_SECRET;
  const mapId = process.env.NEXT_PUBLIC_MAPPEDIN_MAP_ID;
  if (key && secret && mapId) return { key, secret, mapId };
  return DEMO_VENUE;
}
