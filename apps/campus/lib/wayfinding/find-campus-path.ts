/**
 * Campus-side adapter over the generic graph router in
 * `@klorad/core/routing`. Translates the campus `NavNode` / `NavEdge`
 * shape into the engine's `RouteGraph` and applies the campus rule
 * for step-free routing (exclude stair nodes + stair edges).
 *
 * Verticals share the same router but ship their own adapter — a
 * heritage adapter would treat "elevation tier" differently, a
 * mobility adapter would weigh transfers vs walks separately.
 */

import { findPath, type RouteGraph, type RoutePath } from "@klorad/core";
import type { NavEdge, NavNode } from "@klorad/api";

export interface FindCampusPathOptions {
  /** Step-free mode — drop stair nodes/edges and any explicit `accessible:false`. */
  stepFree?: boolean;
}

/**
 * Build a generic `RouteGraph<NavNode, NavEdge>` from the campus
 * graph storage. Vertical metadata rides in the `meta` slot so the
 * router doesn't need to know about it, and the consumer recovers
 * the original record on the returned path via `node.meta`.
 */
export function buildCampusRouteGraph(
  navNodes: NavNode[],
  navEdges: NavEdge[],
): RouteGraph<NavNode, NavEdge> {
  return {
    nodes: navNodes.map((n) => ({
      id: n.id,
      position: n.position,
      level: n.floor ?? null,
      meta: n,
    })),
    edges: navEdges.map((e) => ({
      id: e.id,
      fromNodeId: e.fromNodeId,
      toNodeId: e.toNodeId,
      cost: e.cost,
      meta: e,
    })),
  };
}

/**
 * Find the lowest-cost walking route between two graph nodes.
 *
 * Returns `null` if either endpoint is missing, filtered out by
 * step-free mode, or the destination is unreachable from the
 * source. Cost is in metres, the same units as
 * `haversineDistanceMeters`.
 */
export function findCampusPath(
  navNodes: NavNode[],
  navEdges: NavEdge[],
  fromId: string,
  toId: string,
  opts: FindCampusPathOptions = {},
): RoutePath<NavNode, NavEdge> | null {
  const graph = buildCampusRouteGraph(navNodes, navEdges);
  if (!opts.stepFree) return findPath(graph, fromId, toId);

  const isStepFreeNode = (n: NavNode) =>
    n.type !== "stair" && n.accessible !== false;

  return findPath(graph, fromId, toId, {
    nodeFilter: (node) => (node.meta ? isStepFreeNode(node.meta) : true),
    edgeFilter: (edge, from, to) => {
      // Explicit edge-level opt-out overrides everything.
      if (edge.meta?.accessible === false) return false;
      // Otherwise, both endpoints must be step-free. The node filter
      // already dropped non-step-free nodes; this second check is
      // belt-and-braces for the case where the edge filter runs
      // before the node filter on a given iteration order.
      const fromOk = from.meta ? isStepFreeNode(from.meta) : true;
      const toOk = to.meta ? isStepFreeNode(to.meta) : true;
      return fromOk && toOk;
    },
  });
}
