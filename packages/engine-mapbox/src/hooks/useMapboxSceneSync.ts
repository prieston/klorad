"use client";

import { useEffect, useRef } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import type { MapboxSceneData } from "@klorad/core";
import { applyMapboxSceneToMap } from "../utils/applyMapboxScene";
import { applyMapboxEnvironmentToMap } from "../utils/applyMapboxEnvironment";

async function resolveLayerGeojson(
  data: MapboxSceneData
): Promise<MapboxSceneData> {
  const layers = await Promise.all(
    (data.layers || []).map(async (layer) => {
      if (layer.geojson != null || !layer.geojsonUrl) return layer;
      try {
        const res = await fetch(layer.geojsonUrl);
        const geojson = await res.json();
        return { ...layer, geojson };
      } catch {
        return layer;
      }
    })
  );
  return { ...data, layers };
}

export function useMapboxSceneSync(
  map: MapboxMap | null,
  sceneData: MapboxSceneData
) {
  const prevJson = useRef<string>("");

  useEffect(() => {
    if (!map) return;

    let cancelled = false;

    const run = async () => {
      const resolved = await resolveLayerGeojson(sceneData);
      if (cancelled) return;
      const next = JSON.stringify(resolved);
      if (next === prevJson.current && map.isStyleLoaded()) {
        return;
      }
      prevJson.current = next;

      const apply = () => {
        if (!map.isStyleLoaded()) return;
        applyMapboxEnvironmentToMap(map, resolved);
        applyMapboxSceneToMap(map, resolved);
      };

      if (map.isStyleLoaded()) {
        apply();
      } else {
        map.once("style.load", apply);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [map, sceneData]);
}
