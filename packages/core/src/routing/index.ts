/**
 * Generic graph routing — pure functions, no React, no DOM, no
 * domain dependencies. The wayfinding engine for every Klorad
 * vertical: campus indoor/outdoor walking, mobility transit
 * connections, heritage site paths.
 *
 * The router doesn't know what a "room" or a "stair" is — verticals
 * carry domain meaning in the per-node and per-edge `meta` slot, and
 * filter via `nodeFilter` / `edgeFilter`. Costs default to
 * great-circle distance between node positions (in metres);
 * verticals override per-edge for elevator dwell, stair penalties,
 * or non-geographic graphs.
 */

import { findPath, haversineDistanceMeters } from "./find-path";

export {
  findPath,
  haversineDistanceMeters,
};

export type {
  RouteNode,
  RouteEdge,
  RouteGraph,
  RoutePath,
  FindPathOptions,
  CostFn,
  EdgeFilter,
  NodeFilter,
} from "./find-path";
