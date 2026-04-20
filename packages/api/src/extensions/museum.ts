import { useSceneStore } from "@klorad/core";
import type { ExhibitsAPI } from "../types/interfaces";
import type { ExhibitConfig } from "../types";

export function createExhibitsAPI(): ExhibitsAPI {
  const get = () => useSceneStore.getState();

  return {
    attach(objectId, config: ExhibitConfig) {
      const obj = get().objects.find((o) => o.id === objectId);
      get().updateObjectProperty(objectId, "meta", {
        ...(obj?.meta as Record<string, unknown>),
        exhibit: config,
      });
      if (config.labelVisible) {
        get().updateObjectProperty(objectId, "interactable", true);
      }
    },

    detach(objectId) {
      const obj = get().objects.find((o) => o.id === objectId);
      if (!obj?.meta) return;
      const meta = obj.meta as Record<string, unknown>;
      const rest = Object.fromEntries(Object.entries(meta).filter(([k]) => k !== "exhibit"));
      get().updateObjectProperty(objectId, "meta", rest);
    },

    update(objectId, patch: Partial<ExhibitConfig>) {
      const obj = get().objects.find((o) => o.id === objectId);
      const current = (obj?.meta as Record<string, unknown>)?.exhibit as ExhibitConfig | undefined;
      if (!current) return;
      get().updateObjectProperty(objectId, "meta", {
        ...(obj?.meta as Record<string, unknown>),
        exhibit: { ...current, ...patch },
      });
    },

    get(objectId): ExhibitConfig | null {
      const obj = get().objects.find((o) => o.id === objectId);
      return ((obj?.meta as Record<string, unknown>)?.exhibit as ExhibitConfig) ?? null;
    },

    toggleLabel(objectId, visible) {
      const obj = get().objects.find((o) => o.id === objectId);
      const exhibit = (obj?.meta as Record<string, unknown>)?.exhibit as ExhibitConfig | undefined;
      if (!exhibit) return;
      get().updateObjectProperty(objectId, "meta", {
        ...(obj?.meta as Record<string, unknown>),
        exhibit: { ...exhibit, labelVisible: visible },
      });
    },

    getAll() {
      return get()
        .objects.filter((o) => (o.meta as Record<string, unknown>)?.exhibit)
        .map((o) => ({
          objectId: o.id,
          config: (o.meta as Record<string, unknown>).exhibit as ExhibitConfig,
        }));
    },
  };
}
