import { useSceneStore } from "@klorad/core";
import { v4 as uuidv4 } from "uuid";
import type {
  CampusAPI,
  POIManagerAPI,
  LayersAPI,
  FloorPlansAPI,
  FloorPlan,
  FloorPlanInput,
  Room,
  RoomInput,
  RoomsAPI,
  NavNode,
  NavNodeInput,
  NavNodesAPI,
  NavEdge,
  NavEdgeInput,
  NavEdgesAPI,
} from "../types/interfaces";
import type { POI, POIInput, DataLayer } from "../types/campus";

type PoiMeta = Omit<POI, "id" | "name" | "objectId" | "position">;

function readPoiMeta(obj: { meta?: unknown }): PoiMeta | null {
  const meta = obj.meta as Record<string, unknown> | undefined;
  const poi = meta?.poi as PoiMeta | undefined;
  return poi ?? null;
}

export function createPOIManagerAPI(): POIManagerAPI {
  const get = () => useSceneStore.getState();

  return {
    add(input: POIInput): POI {
      const before = new Set(get().objects.map((o) => o.id));
      get().addModel({
        name: input.name,
        position: input.position ?? [0, 0, 0],
        type: "component",
        interactable: true,
      });
      const added = get().objects.find((o) => !before.has(o.id));
      if (!added) throw new Error(`Failed to add POI ${input.name}`);

      const poiMeta: PoiMeta = {
        category: input.category,
        description: input.description,
        media: input.media ?? [],
        tags: input.tags ?? [],
        hours: input.hours,
        floor: input.floor,
        accessibility: input.accessibility,
        view: input.view,
        linkedBuilding: input.linkedBuilding,
        events: input.events,
        parentBuildingId: input.parentBuildingId,
      };
      get().updateObjectProperty(added.id, "meta", { poi: poiMeta });

      return {
        id: added.id,
        name: added.name ?? "",
        objectId: added.id,
        position: added.position as [number, number, number],
        ...poiMeta,
      };
    },

    update(id, patch) {
      const obj = get().objects.find((o) => o.id === id);
      if (!obj) return;

      const { name, position, ...metaPatch } = patch;
      if (name !== undefined) get().updateObjectProperty(id, "name", name);
      if (position !== undefined) get().updateObjectProperty(id, "position", position);

      if (Object.keys(metaPatch).length === 0) return;
      const currentMeta = (obj.meta as Record<string, unknown> | undefined) ?? {};
      const currentPoi = (currentMeta.poi as Record<string, unknown> | undefined) ?? {};
      get().updateObjectProperty(id, "meta", {
        ...currentMeta,
        poi: { ...currentPoi, ...metaPatch },
      });
    },

    remove(id) {
      get().removeObject(id);
    },

    getAll(): POI[] {
      return get()
        .objects.flatMap((o) => {
          const poiMeta = readPoiMeta(o);
          if (!poiMeta) return [];
          return [{
            id: o.id,
            name: o.name ?? "",
            objectId: o.id,
            position: o.position as [number, number, number],
            ...poiMeta,
          }];
        });
    },

    search(query: string): POI[] {
      const q = query.toLowerCase().trim();
      if (!q) return this.getAll();
      return this.getAll().filter((p) => {
        if (p.name.toLowerCase().includes(q)) return true;
        if (p.description?.toLowerCase().includes(q)) return true;
        if (p.tags?.some((t) => t.toLowerCase().includes(q))) return true;
        if (p.category?.toLowerCase().includes(q)) return true;
        // Building properties — e.g. Mapbox assigns name / class
        const lbProps = p.linkedBuilding?.properties as Record<string, unknown> | undefined;
        if (lbProps) {
          for (const v of Object.values(lbProps)) {
            if (typeof v === "string" && v.toLowerCase().includes(q)) return true;
          }
        }
        // Events — title, course code, lecturer
        if (p.events?.some((e) =>
          e.title.toLowerCase().includes(q) ||
          e.courseCode?.toLowerCase().includes(q) ||
          e.lecturer?.toLowerCase().includes(q)
        )) return true;
        return false;
      });
    },

    async flyTo(id: string) {
      const obj = get().objects.find((o) => o.id === id);
      if (!obj) return;
      get().selectObject(id, null);

      const map = get().mapboxMap as {
        flyTo: (opts: Record<string, unknown>) => void;
        getZoom: () => number;
      } | null;
      if (!map) return;

      const [lng, lat] = obj.position;
      const poiMeta = readPoiMeta(obj);
      const view = poiMeta?.view;

      map.flyTo({
        center: [lng, lat],
        zoom: view?.zoom ?? Math.max(map.getZoom(), 17),
        pitch: view?.pitch ?? 55,
        ...(view?.bearing !== undefined && { bearing: view.bearing }),
        duration: 1800,
        essential: true,
      });
    },
  };
}

export function createFloorPlansAPI(): FloorPlansAPI {
  const get = () => useSceneStore.getState();

  const readPlans = (): FloorPlan[] => {
    const raw = get().mapboxSceneData.floorPlanRasters ?? [];
    return raw.map((r) => ({
      id: r.id,
      name: r.name,
      url: r.url,
      coordinates: r.coordinates as FloorPlan["coordinates"],
      buildingId: r.buildingId,
      floor: r.floor,
      heightM: r.heightM,
      visible: r.visible !== false,
      walls: r.walls as FloorPlan["walls"],
    }));
  };

  const writePlans = (plans: FloorPlan[]) => {
    get().setMapboxSceneData({
      floorPlanRasters: plans.map((p) => ({
        id: p.id,
        name: p.name,
        url: p.url,
        coordinates: p.coordinates,
        buildingId: p.buildingId,
        floor: p.floor,
        heightM: p.heightM,
        visible: p.visible,
        walls: p.walls,
      })),
    });
  };

  return {
    add(input: FloorPlanInput): FloorPlan {
      const plan: FloorPlan = {
        id: input.id ?? uuidv4(),
        name: input.name,
        url: input.url,
        coordinates: input.coordinates,
        buildingId: input.buildingId,
        floor: input.floor,
        heightM: input.heightM,
        visible: input.visible !== false,
        walls: input.walls,
      };
      writePlans([...readPlans(), plan]);
      return plan;
    },
    update(id, patch) {
      writePlans(
        readPlans().map((p) => (p.id === id ? { ...p, ...patch } : p))
      );
    },
    remove(id) {
      writePlans(readPlans().filter((p) => p.id !== id));
    },
    setVisible(id, visible) {
      this.update(id, { visible });
    },
    getAll(): FloorPlan[] {
      return readPlans();
    },
    forBuilding(buildingId: string): FloorPlan[] {
      return readPlans()
        .filter((p) => p.buildingId === buildingId)
        .sort((a, b) => (a.floor ?? 0) - (b.floor ?? 0));
    },
  };
}

export function createRoomsAPI(): RoomsAPI {
  const get = () => useSceneStore.getState();

  const readRooms = (): Room[] => {
    const raw = get().mapboxSceneData.rooms ?? [];
    return raw.map((r) => ({
      id: r.id,
      name: r.name,
      roomNumber: r.roomNumber,
      type: (r.type as Room["type"]) ?? "other",
      templateId: r.templateId,
      buildingId: r.buildingId,
      floor: r.floor,
      polygon: r.polygon as Room["polygon"],
      heightM: r.heightM,
      icon: r.icon,
      color: r.color,
      occupants: r.occupants,
      scheduleUrl: r.scheduleUrl,
      visible: r.visible !== false,
      searchKeywords: (r as { searchKeywords?: string[] }).searchKeywords,
    }));
  };

  const writeRooms = (rooms: Room[]) => {
    get().setMapboxSceneData({
      rooms: rooms.map((r) => ({
        id: r.id,
        name: r.name,
        roomNumber: r.roomNumber,
        type: r.type,
        templateId: r.templateId,
        buildingId: r.buildingId,
        floor: r.floor,
        polygon: r.polygon,
        heightM: r.heightM,
        icon: r.icon,
        color: r.color,
        occupants: r.occupants,
        scheduleUrl: r.scheduleUrl,
        visible: r.visible,
        searchKeywords: r.searchKeywords,
      })),
    });
  };

  return {
    add(input: RoomInput): Room {
      const room: Room = {
        id: input.id ?? uuidv4(),
        name: input.name,
        roomNumber: input.roomNumber,
        type: input.type,
        templateId: input.templateId,
        buildingId: input.buildingId,
        floor: input.floor,
        polygon: input.polygon,
        heightM: input.heightM,
        icon: input.icon,
        color: input.color,
        occupants: input.occupants,
        scheduleUrl: input.scheduleUrl,
        visible: input.visible !== false,
        searchKeywords: input.searchKeywords,
      };
      writeRooms([...readRooms(), room]);
      return room;
    },
    update(id, patch) {
      writeRooms(readRooms().map((r) => (r.id === id ? { ...r, ...patch } : r)));
    },
    remove(id) {
      writeRooms(readRooms().filter((r) => r.id !== id));
    },
    setVisible(id, visible) {
      this.update(id, { visible });
    },
    getAll(): Room[] {
      return readRooms();
    },
    forBuilding(buildingId: string): Room[] {
      return readRooms()
        .filter((r) => r.buildingId === buildingId)
        .sort((a, b) => a.floor - b.floor);
    },
    forFloor(buildingId: string, floor: number): Room[] {
      return readRooms().filter(
        (r) => r.buildingId === buildingId && r.floor === floor
      );
    },
  };
}

export function createNavNodesAPI(): NavNodesAPI {
  const get = () => useSceneStore.getState();

  const readNodes = (): NavNode[] => {
    const raw = get().mapboxSceneData.navNodes ?? [];
    return raw.map((n) => ({ ...n })) as NavNode[];
  };
  const writeNodes = (nodes: NavNode[]) => {
    get().setMapboxSceneData({
      navNodes: nodes.map((n) => ({ ...n })),
    });
  };

  return {
    add(input: NavNodeInput): NavNode {
      const node: NavNode = {
        id: input.id ?? uuidv4(),
        type: input.type,
        position: input.position,
        floor: input.floor,
        buildingId: input.buildingId,
        roomId: input.roomId,
        accessible: input.accessible ?? input.type !== "stair",
        name: input.name,
      };
      writeNodes([...readNodes(), node]);
      return node;
    },
    update(id, patch) {
      writeNodes(readNodes().map((n) => (n.id === id ? { ...n, ...patch } : n)));
    },
    remove(id) {
      writeNodes(readNodes().filter((n) => n.id !== id));
    },
    getAll(): NavNode[] {
      return readNodes();
    },
    forBuilding(buildingId: string, floor?: number): NavNode[] {
      return readNodes().filter(
        (n) =>
          n.buildingId === buildingId &&
          (floor === undefined || n.floor === floor),
      );
    },
    outdoor(): NavNode[] {
      return readNodes().filter(
        (n) => !n.buildingId || n.type === "outdoor",
      );
    },
    forRoom(roomId: string): NavNode | undefined {
      return readNodes().find(
        (n) => n.type === "room-anchor" && n.roomId === roomId,
      );
    },
  };
}

export function createNavEdgesAPI(): NavEdgesAPI {
  const get = () => useSceneStore.getState();

  const readEdges = (): NavEdge[] => {
    const raw = get().mapboxSceneData.navEdges ?? [];
    return raw.map((e) => ({ ...e })) as NavEdge[];
  };
  const writeEdges = (edges: NavEdge[]) => {
    get().setMapboxSceneData({
      navEdges: edges.map((e) => ({ ...e })),
    });
  };

  return {
    add(input: NavEdgeInput): NavEdge {
      const edge: NavEdge = {
        id: input.id ?? uuidv4(),
        fromNodeId: input.fromNodeId,
        toNodeId: input.toNodeId,
        cost: input.cost,
        accessible: input.accessible,
        name: input.name,
      };
      writeEdges([...readEdges(), edge]);
      return edge;
    },
    update(id, patch) {
      writeEdges(readEdges().map((e) => (e.id === id ? { ...e, ...patch } : e)));
    },
    remove(id) {
      writeEdges(readEdges().filter((e) => e.id !== id));
    },
    getAll(): NavEdge[] {
      return readEdges();
    },
    forNode(nodeId: string): NavEdge[] {
      return readEdges().filter(
        (e) => e.fromNodeId === nodeId || e.toNodeId === nodeId,
      );
    },
  };
}

export function createLayersAPI(): LayersAPI {
  const layers = new Map<string, DataLayer>();

  return {
    register(layer: DataLayer) {
      layers.set(layer.id, layer);
    },

    toggle(layerId, visible) {
      const layer = layers.get(layerId);
      if (layer) layers.set(layerId, { ...layer, visible });
    },

    update(layerId, data) {
      const layer = layers.get(layerId);
      if (layer) layers.set(layerId, { ...layer, data });
    },

    getAll(): DataLayer[] {
      return Array.from(layers.values());
    },
  };
}

export function createCampusExtension(): Pick<CampusAPI, "poi" | "layers" | "floorPlans" | "rooms" | "navNodes" | "navEdges" | "setLocation"> {
  return {
    poi: createPOIManagerAPI(),
    layers: createLayersAPI(),
    floorPlans: createFloorPlansAPI(),
    rooms: createRoomsAPI(),
    navNodes: createNavNodesAPI(),
    navEdges: createNavEdgesAPI(),
    setLocation(lng, lat, options = {}) {
      const { zoom, pitch, bearing, fly = true } = options;
      const s = useSceneStore.getState();
      s.setMapboxSceneData({
        center: [lng, lat],
        ...(zoom !== undefined && { zoom }),
        ...(pitch !== undefined && { pitch }),
        ...(bearing !== undefined && { bearing }),
      });
      if (!fly) return;
      const map = s.mapboxMap as {
        flyTo: (opts: Record<string, unknown>) => void;
        getZoom: () => number;
      } | null;
      if (!map) return;
      map.flyTo({
        center: [lng, lat],
        zoom: zoom ?? Math.max(map.getZoom(), 16),
        ...(pitch !== undefined && { pitch }),
        ...(bearing !== undefined && { bearing }),
        duration: 1800,
        essential: true,
      });
    },
  };
}
