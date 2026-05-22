/**
 * Stitched outdoor + indoor wayfinding.
 *
 * Walks the user from an arbitrary start point (their location, a
 * POI, or another room) through outdoor space to the closest
 * external door of the destination building, then continues on the
 * indoor graph to the room's anchor node.
 *
 * The two segments are returned separately so the renderer can
 * style them differently (outdoor: thick blue line, indoor: dashed
 * line that follows the building's X-ray view), and so the
 * summary card can break out walking distance vs. building
 * distance for users planning ahead.
 *
 * If the destination is itself outdoor (or the user's start is
 * already inside the same building), the corresponding segment is
 * `null` — consumers handle one-leg routes naturally.
 */

import { haversineDistanceMeters, type RoutePath } from "@klorad/core";
import { fetchMapboxDirections } from "@klorad/engine-mapbox";
import type { NavEdge, NavNode, POI, Room } from "@klorad/api";
import { findCampusPath } from "./find-campus-path";

export interface StitchedRouteOrigin {
  /** Lng/lat the user starts from. */
  position: [number, number];
  /** Optional human label ("Front gate", "Library"). */
  label?: string;
}

export interface StitchedRouteDestination {
  /** Either a room (resolved via room-anchor node) or a POI. */
  roomId?: string;
  poiId?: string;
}

export interface FindStitchedRouteOptions {
  stepFree?: boolean;
  /** Override the Mapbox access token (else NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN). */
  mapboxAccessToken?: string;
  /** AbortSignal forwarded to the outdoor Directions call. */
  signal?: AbortSignal;
}

export interface StitchedRouteResult {
  /** Outdoor walking polyline, or `null` if no outdoor segment. */
  outdoor: {
    coordinates: [number, number][];
    distanceM: number;
    durationS: number;
  } | null;
  /** Indoor A* path through the building, or `null` if no indoor segment. */
  indoor: RoutePath<NavNode, NavEdge> | null;
  /** Total walking distance in metres (outdoor + indoor). */
  totalDistanceM: number;
  /** Total estimated duration in seconds. */
  totalDurationS: number;
  /** Number of distinct floors visited (1 if the route doesn't change level). */
  floorsTouched: number;
}

interface RouteInputs {
  rooms: Room[];
  pois: POI[];
  navNodes: NavNode[];
  navEdges: NavEdge[];
}

const WALKING_SPEED_MPS = 1.3; // Average campus walking pace.

function nearestExternalDoor(
  navNodes: NavNode[],
  buildingId: string,
  from: [number, number],
): NavNode | null {
  const doors = navNodes.filter(
    (n) => n.type === "door-external" && n.buildingId === buildingId,
  );
  if (doors.length === 0) return null;
  let best: NavNode | null = null;
  let bestDist = Infinity;
  for (const door of doors) {
    const d = haversineDistanceMeters(from, door.position);
    if (d < bestDist) {
      bestDist = d;
      best = door;
    }
  }
  return best;
}

function roomAnchor(navNodes: NavNode[], roomId: string): NavNode | null {
  return (
    navNodes.find((n) => n.type === "room-anchor" && n.roomId === roomId) ??
    null
  );
}

/**
 * Compute the stitched route from `origin` to `destination`.
 *
 * Resolves the destination's anchor node + nearest external door,
 * fetches the outdoor walking polyline via Mapbox Directions, then
 * runs A* over the indoor graph for the building segment.
 *
 * Returns `null` if the indoor graph can't get from the chosen
 * entrance to the destination (room anchor missing, graph not
 * connected, step-free filter eliminates the only path). Outdoor
 * failure (no Mapbox route between the points) doesn't fail the
 * whole call — `outdoor` is null and the consumer can fall back
 * to a great-circle hint line.
 */
export async function findStitchedRoute(
  origin: StitchedRouteOrigin,
  destination: StitchedRouteDestination,
  data: RouteInputs,
  opts: FindStitchedRouteOptions = {},
): Promise<StitchedRouteResult | null> {
  const { rooms, pois, navNodes, navEdges } = data;

  // Resolve destination → an anchor node id + which building it's in.
  let destNode: NavNode | null = null;
  let destBuildingId: string | null = null;
  if (destination.roomId) {
    const room = rooms.find((r) => r.id === destination.roomId);
    if (!room) return null;
    destNode = roomAnchor(navNodes, room.id);
    destBuildingId = room.buildingId;
  } else if (destination.poiId) {
    const poi = pois.find((p) => p.id === destination.poiId);
    if (!poi) return null;
    // For a POI destination, the building it lives in (if any) is its
    // parent — otherwise treat the POI itself as the endpoint and skip
    // the indoor leg entirely.
    if (poi.parentBuildingId) {
      destBuildingId = poi.parentBuildingId;
      // Use the room-anchor if one exists for the POI; else nearest door.
      destNode = roomAnchor(navNodes, poi.id);
    }
  }

  // If we have an indoor destination, find the nearest external door.
  // The outdoor leg ends here; the indoor leg starts here.
  let entranceNode: NavNode | null = null;
  if (destBuildingId) {
    entranceNode = nearestExternalDoor(
      navNodes,
      destBuildingId,
      origin.position,
    );
  }

  // Outdoor segment — origin → (entrance OR final destination position).
  const outdoorTarget: [number, number] | null = entranceNode
    ? entranceNode.position
    : destination.poiId
      ? pois.find((p) => p.id === destination.poiId)?.position
        ? [
            pois.find((p) => p.id === destination.poiId)!.position[0],
            pois.find((p) => p.id === destination.poiId)!.position[1],
          ]
        : null
      : null;

  let outdoor: StitchedRouteResult["outdoor"] = null;
  if (outdoorTarget) {
    try {
      const dir = await fetchMapboxDirections({
        from: origin.position,
        to: outdoorTarget,
        profile: "walking",
        accessToken: opts.mapboxAccessToken,
        signal: opts.signal,
      });
      if (dir) {
        outdoor = {
          coordinates: dir.coordinates,
          distanceM: dir.distanceM,
          durationS: dir.durationS,
        };
      } else {
        // Fall back to a single great-circle line so the renderer
        // can still show a hint even without a routable network.
        const fallbackD = haversineDistanceMeters(
          origin.position,
          outdoorTarget,
        );
        outdoor = {
          coordinates: [origin.position, outdoorTarget],
          distanceM: fallbackD,
          durationS: fallbackD / WALKING_SPEED_MPS,
        };
      }
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") throw err;
      // Same fallback for missing-token cases — render a hint line.
      const fallbackD = haversineDistanceMeters(origin.position, outdoorTarget);
      outdoor = {
        coordinates: [origin.position, outdoorTarget],
        distanceM: fallbackD,
        durationS: fallbackD / WALKING_SPEED_MPS,
      };
    }
  }

  // Indoor segment — entrance → destination anchor.
  let indoor: RoutePath<NavNode, NavEdge> | null = null;
  if (entranceNode && destNode) {
    indoor = findCampusPath(
      navNodes,
      navEdges,
      entranceNode.id,
      destNode.id,
      { stepFree: opts.stepFree },
    );
    if (!indoor) {
      // Indoor unreachable under current filter — surface a null
      // result so the consumer can prompt for a different door /
      // disable step-free.
      return null;
    }
  }

  const totalDistanceM =
    (outdoor?.distanceM ?? 0) + (indoor?.cost ?? 0);
  const totalDurationS =
    (outdoor?.durationS ?? 0) +
    (indoor ? indoor.cost / WALKING_SPEED_MPS : 0);

  const floorsTouched = (() => {
    if (!indoor) return 1;
    const floors = new Set<number>();
    for (const n of indoor.nodes) {
      if (typeof n.level === "number") floors.add(n.level);
    }
    return Math.max(1, floors.size);
  })();

  return {
    outdoor,
    indoor,
    totalDistanceM,
    totalDurationS,
    floorsTouched,
  };
}
