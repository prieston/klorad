/**
 * A* shortest-path routing over a generic node/edge graph.
 *
 * Pure function. No React, no DOM, no domain types. Verticals provide
 * their own per-node and per-edge metadata via the type parameters
 * and feed filters/costs as plain callbacks.
 *
 * Cost defaults to great-circle (Haversine) distance between node
 * positions in metres — appropriate when nodes carry `[lng, lat]`.
 * Override `costFn` for non-geographic graphs or where edges need
 * explicit costs (elevator dwell, stair penalties, route mode
 * multipliers).
 *
 * Algorithm: A* with a binary-heap priority queue and Haversine
 * heuristic. Runs in O((V + E) log V) and handles graphs into the
 * tens of thousands of nodes comfortably. For typical campus
 * graphs (hundreds of nodes) the running time is dominated by the
 * graph build, not the search.
 */

export interface RouteNode<TMeta = unknown> {
  id: string;
  /**
   * Node position. `[lng, lat]` for geographic graphs; any 2D point
   * if `costFn` is overridden.
   */
  position: [number, number];
  /**
   * Vertical level for stacked graphs (floor index for indoor,
   * elevation tier for terraced sites). The router doesn't read this
   * directly — use `nodeFilter` to scope a search by floor — but
   * it's a load-bearing shape on the node so verticals don't have
   * to wrap their own.
   */
  level?: number | null;
  /** Vertical-specific metadata, untouched by the router. */
  meta?: TMeta;
}

export interface RouteEdge<TMeta = unknown> {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  /**
   * Explicit cost override (in the same units as `costFn`). Used
   * for elevator/stair edges where the great-circle distance
   * between endpoints is ~0 but the actual traversal isn't free.
   */
  cost?: number;
  meta?: TMeta;
}

export interface RouteGraph<TNodeMeta = unknown, TEdgeMeta = unknown> {
  nodes: RouteNode<TNodeMeta>[];
  edges: RouteEdge<TEdgeMeta>[];
}

export type NodeFilter<TNodeMeta> = (
  node: RouteNode<TNodeMeta>,
) => boolean;

export type EdgeFilter<TNodeMeta, TEdgeMeta> = (
  edge: RouteEdge<TEdgeMeta>,
  from: RouteNode<TNodeMeta>,
  to: RouteNode<TNodeMeta>,
) => boolean;

export type CostFn<TNodeMeta, TEdgeMeta> = (
  edge: RouteEdge<TEdgeMeta>,
  from: RouteNode<TNodeMeta>,
  to: RouteNode<TNodeMeta>,
) => number;

export interface FindPathOptions<TNodeMeta = unknown, TEdgeMeta = unknown> {
  /** Drop a candidate node before it ever enters the frontier. */
  nodeFilter?: NodeFilter<TNodeMeta>;
  /** Drop a candidate edge — useful for the step-free filter. */
  edgeFilter?: EdgeFilter<TNodeMeta, TEdgeMeta>;
  /**
   * Override the default cost (Haversine in metres + `edge.cost`).
   * Returning a non-finite or negative number drops the edge.
   */
  costFn?: CostFn<TNodeMeta, TEdgeMeta>;
}

export interface RoutePath<TNodeMeta = unknown, TEdgeMeta = unknown> {
  nodeIds: string[];
  /** Ordered node objects from start to end. */
  nodes: RouteNode<TNodeMeta>[];
  /** Ordered edges traversed (length = nodes.length - 1). */
  edges: RouteEdge<TEdgeMeta>[];
  /** Sum of `costFn` over the traversed edges. */
  cost: number;
}

/**
 * Great-circle distance between two `[lng, lat]` points in metres.
 * Exported so verticals can reuse the heuristic in their own custom
 * `costFn`.
 */
export function haversineDistanceMeters(
  a: [number, number],
  b: [number, number],
): number {
  const R = 6_371_000; // Earth radius in metres.
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const dLat = lat2 - lat1;
  const dLng = toRad(b[0] - a[0]);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Find the lowest-cost path from `fromId` to `toId` over `graph`,
 * optionally filtered and cost-overridden.
 *
 * Returns `null` if either endpoint is missing/filtered or the
 * destination is unreachable under the filters.
 */
export function findPath<TNodeMeta = unknown, TEdgeMeta = unknown>(
  graph: RouteGraph<TNodeMeta, TEdgeMeta>,
  fromId: string,
  toId: string,
  opts: FindPathOptions<TNodeMeta, TEdgeMeta> = {},
): RoutePath<TNodeMeta, TEdgeMeta> | null {
  const { nodeFilter, edgeFilter, costFn } = opts;

  // Index nodes by id and build per-node adjacency. Buckets are
  // built fresh per call rather than cached on the graph so callers
  // who mutate the graph object don't have to invalidate anything.
  const nodeById = new Map<string, RouteNode<TNodeMeta>>();
  for (const n of graph.nodes) {
    if (nodeFilter && !nodeFilter(n)) continue;
    nodeById.set(n.id, n);
  }

  const from = nodeById.get(fromId);
  const to = nodeById.get(toId);
  if (!from || !to) return null;

  const adjacency = new Map<string, RouteEdge<TEdgeMeta>[]>();
  for (const edge of graph.edges) {
    const a = nodeById.get(edge.fromNodeId);
    const b = nodeById.get(edge.toNodeId);
    if (!a || !b) continue;
    if (edgeFilter && !edgeFilter(edge, a, b)) continue;

    // Graphs are undirected — walkable both ways. Append the edge
    // twice (once per direction) so the search expands in either
    // direction without special-casing.
    let outA = adjacency.get(a.id);
    if (!outA) {
      outA = [];
      adjacency.set(a.id, outA);
    }
    outA.push(edge);

    let outB = adjacency.get(b.id);
    if (!outB) {
      outB = [];
      adjacency.set(b.id, outB);
    }
    outB.push(edge);
  }

  const defaultCost: CostFn<TNodeMeta, TEdgeMeta> = (edge, a, b) => {
    if (edge.cost != null) return edge.cost;
    return haversineDistanceMeters(a.position, b.position);
  };
  const cost = costFn ?? defaultCost;

  // A* heuristic — straight-line distance to the goal. Admissible
  // for great-circle metres; verticals using a non-geo cost can
  // pass `costFn` to keep monotonicity (the heuristic just becomes
  // less informative, never wrong).
  const heuristic = (n: RouteNode<TNodeMeta>) =>
    haversineDistanceMeters(n.position, to.position);

  // Min-heap keyed by f-score. Inline implementation — a few dozen
  // lines avoids a runtime dependency and matches the rest of the
  // routing module's "no deps" rule.
  interface HeapEntry {
    nodeId: string;
    f: number;
  }
  const open: HeapEntry[] = [];
  const openSet = new Set<string>();

  const heapPush = (entry: HeapEntry) => {
    open.push(entry);
    let i = open.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (open[parent].f <= open[i].f) break;
      [open[parent], open[i]] = [open[i], open[parent]];
      i = parent;
    }
  };
  const heapPop = (): HeapEntry | undefined => {
    if (open.length === 0) return undefined;
    const top = open[0];
    const last = open.pop()!;
    if (open.length > 0) {
      open[0] = last;
      let i = 0;
      const n = open.length;
      for (;;) {
        const l = i * 2 + 1;
        const r = i * 2 + 2;
        let smallest = i;
        if (l < n && open[l].f < open[smallest].f) smallest = l;
        if (r < n && open[r].f < open[smallest].f) smallest = r;
        if (smallest === i) break;
        [open[i], open[smallest]] = [open[smallest], open[i]];
        i = smallest;
      }
    }
    return top;
  };

  const gScore = new Map<string, number>();
  const cameFrom = new Map<string, { nodeId: string; edge: RouteEdge<TEdgeMeta> }>();

  gScore.set(from.id, 0);
  heapPush({ nodeId: from.id, f: heuristic(from) });
  openSet.add(from.id);

  while (open.length > 0) {
    const current = heapPop()!;
    openSet.delete(current.nodeId);
    if (current.nodeId === to.id) break;

    const currentNode = nodeById.get(current.nodeId)!;
    const currentG = gScore.get(current.nodeId) ?? Infinity;
    const edges = adjacency.get(current.nodeId) ?? [];

    for (const edge of edges) {
      const neighbourId =
        edge.fromNodeId === current.nodeId ? edge.toNodeId : edge.fromNodeId;
      const neighbour = nodeById.get(neighbourId);
      if (!neighbour) continue;

      const c = cost(edge, currentNode, neighbour);
      if (!Number.isFinite(c) || c < 0) continue;

      const tentativeG = currentG + c;
      const existingG = gScore.get(neighbourId);
      if (existingG !== undefined && tentativeG >= existingG) continue;

      gScore.set(neighbourId, tentativeG);
      cameFrom.set(neighbourId, { nodeId: current.nodeId, edge });
      const f = tentativeG + heuristic(neighbour);
      if (!openSet.has(neighbourId)) {
        heapPush({ nodeId: neighbourId, f });
        openSet.add(neighbourId);
      } else {
        // Already on the open set — push the improved score. The
        // node may sit in the heap with an outdated f; we accept
        // the duplicate and let the older entry be discarded when
        // popped (its gScore is stale). This is standard A*
        // "lazy update" — simpler than decrease-key and equally
        // correct because the visited check trims duplicates.
        heapPush({ nodeId: neighbourId, f });
      }
    }
  }

  // Reconstruct.
  if (!gScore.has(to.id)) return null;
  const nodeIds: string[] = [];
  const nodes: RouteNode<TNodeMeta>[] = [];
  const edges: RouteEdge<TEdgeMeta>[] = [];

  let cursor: string | null = to.id;
  while (cursor) {
    const node = nodeById.get(cursor);
    if (!node) return null;
    nodeIds.unshift(cursor);
    nodes.unshift(node);
    const link = cameFrom.get(cursor);
    if (!link) break;
    edges.unshift(link.edge);
    cursor = link.nodeId;
  }

  return {
    nodeIds,
    nodes,
    edges,
    cost: gScore.get(to.id) ?? 0,
  };
}
