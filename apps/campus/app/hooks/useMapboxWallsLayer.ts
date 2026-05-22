"use client";

import { useEffect } from "react";
import type { GeoJSONSource, Map as MapboxMap } from "mapbox-gl";
import { useSceneStore } from "@klorad/core";
import type { Wall } from "@klorad/api";

const SOURCE_ID = "campus-walls";
const LAYER_ID = "campus-walls-line";

/**
 * Renders the given walls as a crisp line layer on the Mapbox map.
 * Walls are drawn polylines on a floor plan; passing the active
 * plan's walls keeps the layer scoped to what the user is editing.
 */
export function useMapboxWallsLayer(walls: Wall[]) {
  const map = useSceneStore((s) => s.mapboxMap as MapboxMap | null);

  useEffect(() => {
    if (!map) return;

    const data: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: walls
        .filter((w) => w.points.length >= 2)
        .map((w) => ({
          type: "Feature",
          properties: { id: w.id },
          geometry: { type: "LineString", coordinates: w.points },
        })),
    };

    const install = () => {
      if (!map.isStyleLoaded()) return;
      const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      if (source) {
        source.setData(data);
        return;
      }
      map.addSource(SOURCE_ID, { type: "geojson", data });
      map.addLayer({
        id: LAYER_ID,
        type: "line",
        source: SOURCE_ID,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#1f2937", "line-width": 3 },
      });
    };

    install();
    const onStyle = () => install();
    map.on("style.load", onStyle);
    map.on("idle", onStyle);

    return () => {
      map.off("style.load", onStyle);
      map.off("idle", onStyle);
      try {
        if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      } catch {
        /* style already torn down */
      }
    };
  }, [map, walls]);
}
