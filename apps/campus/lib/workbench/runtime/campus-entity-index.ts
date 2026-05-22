import type {
  Entity,
  EntityId,
  EntityIndex,
  EntityTypeId,
} from "@klorad/config/workbench";
import type {
  FloorPlan,
  NavEdge,
  NavNode,
  POI,
  POIEvent,
  Room,
  TourStop,
} from "@klorad/api";
import type { Building } from "../entities/building";

/**
 * Inputs the adapter needs to project campus data into typed entities.
 * Today these come from a `CampusAPI` instance loaded against a world:
 *
 * ```ts
 * const api = createSceneAPI("mapbox", "campus") as CampusAPI;
 * api.load(map.sceneData);
 * const index = createCampusEntityIndex({
 *   worldId: map.id,
 *   pois: api.poi.getAll(),
 *   floorPlans: api.floorPlans.getAll(),
 *   tourStops: [],   // TBD — surface via api in Phase 5
 * });
 * ```
 */
export interface CampusEntitySources {
  worldId: string;
  pois: POI[];
  floorPlans: FloorPlan[];
  rooms: Room[];
  tourStops: TourStop[];
  /**
   * Wayfinding graph waypoints — corridor, door, elevator/stair,
   * room-anchor, outdoor. Pass `[]` if the campus hasn't started
   * authoring its nav graph yet.
   */
  navNodes: NavNode[];
  /** Edges between {@link navNodes}. */
  navEdges: NavEdge[];
}

/**
 * Build an `EntityIndex` over campus data — the read-through bridge
 * between today's `Map.sceneData` storage and the Workbench shell's
 * typed view of the world.
 *
 * Read-through, **not write-through**. Writes keep going through the
 * existing `api.poi.add(...)` paths; this adapter never mutates the
 * source. Phase 5 reroutes writes via `ctx.runOperation`.
 *
 * `subscribe` is a noop because the index is immutable for its
 * lifetime — when source data changes, consumers recreate the index
 * with `useMemo`, and the Workbench shell sees a new reference and
 * re-renders naturally.
 *
 * Two derivations to note:
 *
 * - **Buildings** are today carried as `POI.linkedBuilding` (one
 *   polygon nested on a POI). The adapter promotes them to first-class
 *   `Entity<Building>` instances so the Workbench can talk about them
 *   independently. For now they share the POI's id; Phase 5+ migrates
 *   to separate ids.
 * - **Events** are today nested on POIs (`POI.events`). The adapter
 *   flattens them across POIs so a future Timeline view can filter
 *   without walking through the POI graph.
 */
export function createCampusEntityIndex({
  worldId,
  pois,
  floorPlans,
  rooms,
  tourStops,
  navNodes,
  navEdges,
}: CampusEntitySources): EntityIndex {
  const poiEntities: Entity<POI>[] = pois.map((poi) => ({
    id: poi.id,
    typeId: "campus.poi",
    worldId,
    payload: poi,
    createdAt: "",
    updatedAt: "",
  }));

  const buildingEntities: Entity<Building>[] = pois
    .filter((p): p is POI & { linkedBuilding: NonNullable<POI["linkedBuilding"]> } =>
      Boolean(p.linkedBuilding),
    )
    .map((p) => ({
      id: p.id,
      typeId: "campus.building",
      worldId,
      payload: {
        id: p.id,
        name: p.linkedBuilding.label ?? p.name,
        centroid: [p.linkedBuilding.lng, p.linkedBuilding.lat] as [number, number],
        polygon: p.linkedBuilding.polygon,
        heightM: p.linkedBuilding.heightM,
        mapboxFeatureId: p.linkedBuilding.featureId,
        properties: p.linkedBuilding.properties,
      },
      createdAt: "",
      updatedAt: "",
    }));

  const floorPlanEntities: Entity<FloorPlan>[] = floorPlans.map((plan) => ({
    id: plan.id,
    typeId: "campus.floor-plan",
    worldId,
    payload: plan,
    createdAt: "",
    updatedAt: "",
  }));

  const roomEntities: Entity<Room>[] = rooms.map((room) => ({
    id: room.id,
    typeId: "campus.room",
    worldId,
    payload: room,
    createdAt: "",
    updatedAt: "",
  }));

  const tourStopEntities: Entity<TourStop>[] = tourStops.map((stop) => ({
    id: String(stop.id),
    typeId: "campus.tour-stop",
    worldId,
    payload: stop,
    createdAt: "",
    updatedAt: "",
  }));

  const eventEntities: Entity<POIEvent>[] = pois.flatMap((poi) =>
    (poi.events ?? []).map((event) => ({
      id: event.id,
      typeId: "campus.event",
      worldId,
      payload: event,
      createdAt: "",
      updatedAt: "",
    })),
  );

  const navNodeEntities: Entity<NavNode>[] = navNodes.map((node) => ({
    id: node.id,
    typeId: "campus.nav-node",
    worldId,
    payload: node,
    createdAt: "",
    updatedAt: "",
  }));

  const navEdgeEntities: Entity<NavEdge>[] = navEdges.map((edge) => ({
    id: edge.id,
    typeId: "campus.nav-edge",
    worldId,
    payload: edge,
    createdAt: "",
    updatedAt: "",
  }));

  const all: Entity[] = [
    ...poiEntities,
    ...buildingEntities,
    ...floorPlanEntities,
    ...roomEntities,
    ...tourStopEntities,
    ...eventEntities,
    ...navNodeEntities,
    ...navEdgeEntities,
  ];

  const byIdMap = new Map<EntityId, Entity>(all.map((e) => [e.id, e]));

  const byTypeMap = new Map<EntityTypeId, Entity[]>([
    ["campus.poi", poiEntities],
    ["campus.building", buildingEntities],
    ["campus.floor-plan", floorPlanEntities],
    ["campus.room", roomEntities],
    ["campus.tour-stop", tourStopEntities],
    ["campus.event", eventEntities],
    ["campus.nav-node", navNodeEntities],
    ["campus.nav-edge", navEdgeEntities],
  ]);

  return {
    byId: (id) => byIdMap.get(id),
    byType: (typeId) => byTypeMap.get(typeId) ?? [],
    all: () => all,
    subscribe: () => () => {
      /* immutable for this index's lifetime — recreate on change */
    },
  };
}
