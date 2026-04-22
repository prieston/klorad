"use client";

import { useEffect, useRef } from "react";
import type { Map as MapboxMap, GeoJSONSource, MapMouseEvent } from "mapbox-gl";
import { useSceneStore } from "@klorad/core";
import type { POI } from "@klorad/api";

export const POI_SOURCE_ID = "campus-pois";
export const POI_PIN_LAYER_ID = "campus-pois-pin";
export const POI_LABEL_LAYER_ID = "campus-pois-label";

const SOURCE_ID = POI_SOURCE_ID;
const PIN_LAYER_ID = POI_PIN_LAYER_ID;
const LABEL_LAYER_ID = POI_LABEL_LAYER_ID;

const CATEGORY_COLOR_EXPR = [
  "match",
  ["coalesce", ["get", "category"], "custom"],
  "building", "#3b82f6",
  "department", "#8b5cf6",
  "library", "#f59e0b",
  "dining", "#10b981",
  "parking", "#6b7280",
  "sports", "#ef4444",
  "medical", "#ec4899",
  "admin", "#0ea5e9",
  "housing", "#f97316",
  "amenity", "#84cc16",
  "#94a3b8",
] as unknown as mapboxgl.ExpressionSpecification;

function toFeatureCollection(
  pois: POI[],
  selectedPoiId: string | null
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: pois.map((poi) => {
      // If the POI is linked to a building, render it at the building's
      // position — conceptually the building IS the POI once linked.
      const lng = poi.linkedBuilding?.lng ?? poi.position[0];
      const lat = poi.linkedBuilding?.lat ?? poi.position[1];
      return {
        type: "Feature",
        id: poi.id,
        geometry: {
          type: "Point",
          coordinates: [lng, lat],
        },
        properties: {
          id: poi.id,
          name: poi.name,
          category: poi.category ?? "custom",
          selected: poi.id === selectedPoiId,
          linked: Boolean(poi.linkedBuilding),
        },
      };
    }),
  };
}

export interface UseMapboxPoiLayerOptions {
  pois: POI[];
  selectedPoiId: string | null;
  onPoiClick?: (id: string) => void;
}

/**
 * Renders the given POIs on the Mapbox map as a category-colored circle
 * layer plus a text-label layer. Keeps the source in sync with the pois
 * array; fires onPoiClick when a pin is clicked.
 */
export function useMapboxPoiLayer({
  pois,
  selectedPoiId,
  onPoiClick,
}: UseMapboxPoiLayerOptions): void {
  const onClickRef = useRef(onPoiClick);
  onClickRef.current = onPoiClick;

  // Reactive subscription — the map is created async by MapboxViewer, so we
  // need to re-run this effect once it becomes available.
  const map = useSceneStore((s) => s.mapboxMap as MapboxMap | null);

  useEffect(() => {
    if (!map) return;

    const install = () => {
      if (!map.isStyleLoaded()) return false;

      const data = toFeatureCollection(pois, selectedPoiId);

      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, { type: "geojson", data });
      }

      if (!map.getLayer(PIN_LAYER_ID)) {
        map.addLayer({
          id: PIN_LAYER_ID,
          type: "circle",
          source: SOURCE_ID,
          paint: {
            "circle-radius": [
              "case",
              ["get", "selected"],
              10,
              7,
            ] as unknown as mapboxgl.ExpressionSpecification,
            "circle-color": CATEGORY_COLOR_EXPR,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": [
              "case",
              ["get", "selected"],
              3,
              2,
            ] as unknown as mapboxgl.ExpressionSpecification,
            "circle-opacity": 1,
          },
        });
        map.addLayer({
          id: LABEL_LAYER_ID,
          type: "symbol",
          source: SOURCE_ID,
          layout: {
            "text-field": ["get", "name"] as unknown as mapboxgl.ExpressionSpecification,
            "text-size": 13,
            "text-offset": [0, 1.4],
            "text-anchor": "top",
            // Intentionally no text-font: let the current style's default
            // glyph set render. Specifying a font not in the style's glyph
            // pack causes silent rendering failure on Standard v3.
            "text-allow-overlap": true,
            "text-ignore-placement": true,
          },
          paint: {
            "text-color": "#ffffff",
            "text-halo-color": "rgba(0,0,0,0.85)",
            "text-halo-width": 1.8,
          },
        });
      }
      return true;
    };

    const onClick = (e: MapMouseEvent & { features?: GeoJSON.Feature[] }) => {
      const f = e.features?.[0];
      const id = f?.properties?.id ?? f?.id;
      if (id && onClickRef.current) onClickRef.current(String(id));
    };
    const onEnter = () => (map.getCanvas().style.cursor = "pointer");
    const onLeave = () => (map.getCanvas().style.cursor = "");

    const attachHandlersOnce = () => {
      if (!map.getLayer(PIN_LAYER_ID)) return;
      map.off("click", PIN_LAYER_ID, onClick);
      map.off("mouseenter", PIN_LAYER_ID, onEnter);
      map.off("mouseleave", PIN_LAYER_ID, onLeave);
      map.on("click", PIN_LAYER_ID, onClick);
      map.on("mouseenter", PIN_LAYER_ID, onEnter);
      map.on("mouseleave", PIN_LAYER_ID, onLeave);
    };

    const tryInstall = () => {
      if (install()) {
        attachHandlersOnce();
      }
    };

    // Try immediately (covers: style already loaded by the time we mount)
    tryInstall();
    // style.load fires on every setStyle + on initial load
    map.on("style.load", tryInstall);
    // idle fires repeatedly when map settles — safety net for the race
    // where style.load fired before our listener attached.
    map.on("idle", tryInstall);

    return () => {
      map.off("style.load", tryInstall);
      map.off("idle", tryInstall);
      try {
        map.off("click", PIN_LAYER_ID, onClick);
        map.off("mouseenter", PIN_LAYER_ID, onEnter);
        map.off("mouseleave", PIN_LAYER_ID, onLeave);
        if (map.getLayer(LABEL_LAYER_ID)) map.removeLayer(LABEL_LAYER_ID);
        if (map.getLayer(PIN_LAYER_ID)) map.removeLayer(PIN_LAYER_ID);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Update source data whenever pois / selectedPoiId change
  useEffect(() => {
    if (!map) return;
    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    if (source) {
      source.setData(toFeatureCollection(pois, selectedPoiId));
    }
    // If the source doesn't exist yet, the install effect's `idle`/`style.load`
    // listeners will pick up the fresh data from closure when they run next.
  }, [map, pois, selectedPoiId]);
}
