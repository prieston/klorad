import { useSceneStore } from "@klorad/core";
import type { CampusAPI, POIManagerAPI, LayersAPI } from "../types/interfaces";
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
      const q = query.toLowerCase();
      return this.getAll().filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.tags?.some((t) => t.toLowerCase().includes(q)) ||
          p.category?.toLowerCase().includes(q)
      );
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

export function createCampusExtension(): Pick<CampusAPI, "poi" | "layers" | "setLocation"> {
  return {
    poi: createPOIManagerAPI(),
    layers: createLayersAPI(),
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
