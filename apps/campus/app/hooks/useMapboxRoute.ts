"use client";

import { useEffect, useState } from "react";
import type { Map as MapboxMap, GeoJSONSource } from "mapbox-gl";
import { useSceneStore } from "@klorad/core";

const SOURCE_ID = "campus-route";
const LINE_LAYER_ID = "campus-route-line";
const CASING_LAYER_ID = "campus-route-line-casing";

export type RouteMode = "walk" | "a11y";

export interface Route {
  geojson: GeoJSON.LineString;
  /** Meters */
  distance: number;
  /** Seconds */
  duration: number;
  mode: RouteMode;
}

export interface UseMapboxRouteResult {
  route: Route | null;
  loading: boolean;
  error: string | null;
  /** Request a route. Passing null to any argument clears the current route. */
  request: (
    from: [number, number] | null,
    to: [number, number] | null,
    mode: RouteMode
  ) => Promise<void>;
  clear: () => void;
}

/**
 * Fetches walking routes from the Mapbox Directions API and keeps the
 * result rendered on the active map as a stylized line (casing + main
 * stroke). Color depends on mode: standard → primary blue; accessible
 * → purple.
 *
 * Accessible mode uses the same walking profile today; true step-free
 * routing arrives when we have campus-level barrier data.
 */
export function useMapboxRoute(
  accessToken: string | undefined
): UseMapboxRouteResult {
  const map = useSceneStore((s) => s.mapboxMap as MapboxMap | null);
  const [route, setRoute] = useState<Route | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = async (
    from: [number, number] | null,
    to: [number, number] | null,
    mode: RouteMode
  ) => {
    if (!from || !to) {
      setRoute(null);
      return;
    }
    if (!accessToken) {
      setError("Missing Mapbox access token");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const coords = `${from[0]},${from[1]};${to[0]},${to[1]}`;
      const url =
        `https://api.mapbox.com/directions/v5/mapbox/walking/${coords}` +
        `?geometries=geojson&overview=full&steps=false` +
        `&access_token=${encodeURIComponent(accessToken)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Directions ${res.status}`);
      const data = await res.json();
      const r = data.routes?.[0];
      if (!r) throw new Error("No route found");
      setRoute({
        geojson: r.geometry,
        distance: r.distance,
        duration: r.duration,
        mode,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Routing failed");
      setRoute(null);
    } finally {
      setLoading(false);
    }
  };

  const clear = () => setRoute(null);

  // Render / update the route line on the map
  useEffect(() => {
    if (!map) return;

    const install = () => {
      if (!map.isStyleLoaded()) return;

      if (!route) {
        try {
          if (map.getLayer(LINE_LAYER_ID)) map.removeLayer(LINE_LAYER_ID);
          if (map.getLayer(CASING_LAYER_ID)) map.removeLayer(CASING_LAYER_ID);
          if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
        } catch {
          /* ignore */
        }
        return;
      }

      const color = route.mode === "a11y" ? "#a78bfa" : "#6b9cd8";
      const data: GeoJSON.Feature = {
        type: "Feature",
        geometry: route.geojson,
        properties: {},
      };

      if (map.getSource(SOURCE_ID)) {
        (map.getSource(SOURCE_ID) as GeoJSONSource).setData(data);
      } else {
        map.addSource(SOURCE_ID, { type: "geojson", data });
      }
      if (!map.getLayer(CASING_LAYER_ID)) {
        map.addLayer({
          id: CASING_LAYER_ID,
          type: "line",
          source: SOURCE_ID,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#ffffff",
            "line-width": 9,
            "line-opacity": 0.55,
          },
        });
      }
      if (!map.getLayer(LINE_LAYER_ID)) {
        map.addLayer({
          id: LINE_LAYER_ID,
          type: "line",
          source: SOURCE_ID,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": color,
            "line-width": 5,
            "line-opacity": 0.95,
          },
        });
      } else {
        map.setPaintProperty(LINE_LAYER_ID, "line-color", color);
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
    };
  }, [map, route]);

  return { route, loading, error, request, clear };
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const min = Math.round(seconds / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}
