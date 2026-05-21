/**
 * Thin wrapper around the Mapbox Directions API
 * (https://docs.mapbox.com/api/navigation/directions/).
 *
 * Returns a walking-mode polyline between two `[lng, lat]` points.
 * The wayfinding stitcher uses this for outdoor segments before
 * handing off to the building's indoor A* graph at the nearest
 * entrance node.
 *
 * Provider-agnostic shape: verticals that swap Mapbox for another
 * directions provider only need to match the `MapboxDirectionsResult`
 * return shape — the consumers care about `coordinates`,
 * `distanceM`, and `durationS`.
 */

export type MapboxDirectionsProfile =
  | "walking"
  | "cycling"
  | "driving"
  | "driving-traffic";

export interface MapboxDirectionsResult {
  /** Ordered `[lng, lat]` polyline. */
  coordinates: [number, number][];
  /** Total distance in metres. */
  distanceM: number;
  /** Estimated duration in seconds. */
  durationS: number;
}

export interface FetchMapboxDirectionsOptions {
  from: [number, number];
  to: [number, number];
  /** Defaults to `"walking"`. */
  profile?: MapboxDirectionsProfile;
  /** Provide one explicitly, else falls back to `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`. */
  accessToken?: string;
  /** Pass an AbortSignal so callers can cancel in-flight requests. */
  signal?: AbortSignal;
}

/**
 * Fetch a walking (or other) route between two coordinates.
 *
 * Returns `null` when the API responds without a route — both
 * "outside the routable network" and a network failure return
 * `null` so consumers can fall back gracefully without try/catch
 * sprinkled across the call sites. Real errors (missing token,
 * abort) are still thrown.
 */
export async function fetchMapboxDirections(
  opts: FetchMapboxDirectionsOptions,
): Promise<MapboxDirectionsResult | null> {
  const profile = opts.profile ?? "walking";
  const token =
    opts.accessToken ??
    (typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
      : undefined);
  if (!token) {
    throw new Error(
      "fetchMapboxDirections: no access token (pass `accessToken` or set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN)",
    );
  }

  const [fromLng, fromLat] = opts.from;
  const [toLng, toLat] = opts.to;
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/${profile}/` +
    `${fromLng},${fromLat};${toLng},${toLat}` +
    `?geometries=geojson&overview=full&access_token=${token}`;

  let res: Response;
  try {
    res = await fetch(url, { signal: opts.signal });
  } catch (err) {
    if ((err as { name?: string })?.name === "AbortError") throw err;
    return null;
  }
  if (!res.ok) return null;

  const data = (await res.json()) as {
    routes?: Array<{
      geometry?: { coordinates?: [number, number][] };
      distance?: number;
      duration?: number;
    }>;
  };
  const route = data.routes?.[0];
  if (!route?.geometry?.coordinates?.length) return null;

  return {
    coordinates: route.geometry.coordinates,
    distanceM: route.distance ?? 0,
    durationS: route.duration ?? 0,
  };
}
