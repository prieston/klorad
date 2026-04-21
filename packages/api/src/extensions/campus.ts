import { useSceneStore } from "@klorad/core";
import type { CampusAPI, POIManagerAPI, LayersAPI } from "../types/interfaces";
import type { POI, POIInput, DataLayer } from "../types/campus";

export function createPOIManagerAPI(): POIManagerAPI {
  const get = () => useSceneStore.getState();

  return {
    add(input: POIInput): POI {
      get().addModel({
        id: input.id,
        name: input.name,
        position: input.position ?? [0, 0, 0],
        type: "component",
        interactable: true,
        meta: {
          poi: {
            category: input.category,
            description: input.description,
            media: input.media ?? [],
            tags: input.tags ?? [],
            hours: input.hours,
            floor: input.floor,
            accessibility: input.accessibility,
          },
        },
      });
      const added = get().objects.find((o) => o.name === input.name);
      if (!added) throw new Error(`Failed to add POI ${input.name}`);
      return {
        id: added.id,
        name: added.name ?? "",
        objectId: added.id,
        position: added.position as [number, number, number],
        ...(added.meta as Record<string, unknown>).poi as Omit<POI, "id" | "name" | "objectId" | "position">,
      };
    },

    update(id, patch) {
      const obj = get().objects.find((o) => o.id === id);
      if (!obj) return;
      const currentPoi = (obj.meta as Record<string, unknown>)?.poi as Record<string, unknown> ?? {};
      get().updateObjectProperty(id, "meta", {
        ...(obj.meta as Record<string, unknown>),
        poi: { ...currentPoi, ...patch },
      });
      if (patch.name) get().updateObjectProperty(id, "name", patch.name);
    },

    remove(id) {
      get().removeObject(id);
    },

    getAll(): POI[] {
      return get()
        .objects.filter((o) => (o.meta as Record<string, unknown>)?.poi)
        .map((o) => ({
          id: o.id,
          name: o.name ?? "",
          objectId: o.id,
          position: o.position as [number, number, number],
          ...(o.meta as Record<string, unknown>).poi as Omit<POI, "id" | "name" | "objectId" | "position">,
        }));
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
      get().selectObject(id, null);
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

export function createCampusExtension(): Pick<CampusAPI, "poi" | "layers"> {
  return {
    poi: createPOIManagerAPI(),
    layers: createLayersAPI(),
  };
}
