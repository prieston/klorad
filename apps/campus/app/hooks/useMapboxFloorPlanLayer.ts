"use client";

import { useEffect } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { useSceneStore } from "@klorad/core";
import type { FloorPlan } from "@klorad/api";

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
 * removed. Raster renders immediately (no fade) so the user never sees
 * the dark pre-load flash that the old roof-lift mask caused.
 */
export function useMapboxFloorPlanLayer(activePlan: FloorPlan | null) {
  const map = useSceneStore((s) => s.mapboxMap as MapboxMap | null);

  useEffect(() => {
    if (!map) return;

    const sourceId = activePlan ? `campus-floorplan-${activePlan.id}` : null;
    const layerId = activePlan ? `${sourceId}-layer` : null;

    const removeStalePlans = () => {
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
      // Legacy: clean up the retired roof-lift mask if it ever leaked in.
      try {
        if (map.getLayer("campus-building-dim-layer"))
          map.removeLayer("campus-building-dim-layer");
        if (map.getSource("campus-building-dim"))
          map.removeSource("campus-building-dim");
      } catch {
        /* ignore */
      }
    };

    const install = () => {
      if (!map.isStyleLoaded()) return;
      if (!activePlan || !sourceId || !layerId) {
        removeStalePlans();
        return;
      }
      // A floor without an uploaded image is still a valid floor — we
      // just don't render any raster overlay for it.
      if (!activePlan.url || !activePlan.coordinates) {
        removeStalePlans();
        return;
      }

      removeStalePlans();

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
            // Snap the plan in — any fade or initial opacity caused the
            // visible dark flash users were seeing on toggle.
            "raster-opacity": 1,
            "raster-fade-duration": 0,
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
      removeStalePlans();
    };
  }, [map, activePlan]);
}
