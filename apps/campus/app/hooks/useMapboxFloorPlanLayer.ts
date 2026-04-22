"use client";

import { useEffect } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { useSceneStore } from "@klorad/core";
import type { FloorPlan } from "@klorad/api";

const BUILDING_DIM_SOURCE = "campus-building-dim";
const BUILDING_DIM_LAYER = "campus-building-dim-layer";

/**
 * Wrap a floor plan URL with our same-origin proxy when it's cross-origin,
 * so Mapbox can fetch it with CORS and the canvas stays screenshot-safe.
 */
function withProxy(url: string): string {
  if (!url) return url;
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;
  if (typeof window === "undefined") return url;
  try {
    const asUrl = new URL(url, window.location.origin);
    if (asUrl.origin === window.location.origin) return url;
    return `/api/image-proxy?url=${encodeURIComponent(asUrl.toString())}`;
  } catch {
    return url;
  }
}

/**
 * Keeps exactly one floor plan image source + a raster layer on the map
 * that corresponds to `activePlan`. When activePlan is null, both are
 * removed. Also applies the "Roof Lift" — dims the Mapbox Standard v3
 * building footprint under the plan so visitors see the floor clearly.
 *
 * For Mapbox Standard v3 we can't feature-state the buildings featureset
 * for an arbitrary building, so for MVP we paint a semi-transparent mask
 * polygon over the floor plan's coverage — same visual effect without
 * wrestling with the private-basemap imports.
 */
export function useMapboxFloorPlanLayer(activePlan: FloorPlan | null) {
  const map = useSceneStore((s) => s.mapboxMap as MapboxMap | null);

  useEffect(() => {
    if (!map) return;

    const sourceId = activePlan ? `campus-floorplan-${activePlan.id}` : null;
    const layerId = activePlan ? `${sourceId}-layer` : null;

    const removeAll = () => {
      const style = map.getStyle();
      if (!style) return;
      // Remove any stale floor plan layers/sources from previous activePlan.
      const layers = style.layers ?? [];
      for (const l of layers) {
        if (l.id.startsWith("campus-floorplan-") && l.id !== layerId) {
          try { map.removeLayer(l.id); } catch { /* ignore */ }
        }
      }
      const sources = style.sources ?? {};
      for (const sid of Object.keys(sources)) {
        if (sid.startsWith("campus-floorplan-") && sid !== sourceId) {
          try { map.removeSource(sid); } catch { /* ignore */ }
        }
      }
      try {
        if (map.getLayer(BUILDING_DIM_LAYER)) map.removeLayer(BUILDING_DIM_LAYER);
        if (map.getSource(BUILDING_DIM_SOURCE)) map.removeSource(BUILDING_DIM_SOURCE);
      } catch {
        /* ignore */
      }
    };

    const install = () => {
      if (!map.isStyleLoaded()) return;
      if (!activePlan || !sourceId || !layerId) {
        removeAll();
        return;
      }

      // Clean up any plan that isn't the active one.
      removeAll();

      // Roof-lift mask: a filled polygon over the plan's footprint that
      // darkens the Standard building underneath, creating the "lift" feel.
      const maskPolygon: GeoJSON.Feature = {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [[
            activePlan.coordinates[0],
            activePlan.coordinates[1],
            activePlan.coordinates[2],
            activePlan.coordinates[3],
            activePlan.coordinates[0],
          ]],
        },
        properties: {},
      };
      map.addSource(BUILDING_DIM_SOURCE, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [maskPolygon] },
      });
      map.addLayer({
        id: BUILDING_DIM_LAYER,
        type: "fill",
        source: BUILDING_DIM_SOURCE,
        paint: {
          "fill-color": "#0a0d10",
          "fill-opacity": 0.55,
        },
      });

      // Floor plan image raster on top of the mask.
      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, {
          type: "image",
          url: withProxy(activePlan.url),
          coordinates: activePlan.coordinates,
        });
      }
      if (!map.getLayer(layerId)) {
        map.addLayer({
          id: layerId,
          type: "raster",
          source: sourceId,
          paint: {
            "raster-opacity": 0.92,
            "raster-fade-duration": 400,
          },
        });
      }
    };

    install();
    const onStyleLoad = () => install();
    const onIdle = () => install();
    map.on("style.load", onStyleLoad);
    map.on("idle", onIdle);

    return () => {
      map.off("style.load", onStyleLoad);
      map.off("idle", onIdle);
      removeAll();
    };
  }, [map, activePlan]);
}
