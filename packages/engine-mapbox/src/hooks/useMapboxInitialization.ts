"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { useSceneStore } from "@klorad/core";

export interface UseMapboxInitializationResult {
  map: mapboxgl.Map | null;
  error: string | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function useMapboxInitialization(
  accessToken: string | undefined
): UseMapboxInitializationResult {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  const [error, setError] = useState<string | null>(null);
  const setMapboxMap = useSceneStore((s) => s.setMapboxMap);
  const mapboxSceneData = useSceneStore((s) => s.mapboxSceneData);
  const previewMode = useSceneStore((s) => s.previewMode);

  const tearDown = useCallback(() => {
    if (mapRef.current) {
      try {
        mapRef.current.remove();
      } catch {
        /* ignore */
      }
      mapRef.current = null;
    }
    setMap(null);
    setMapboxMap(null);
  }, [setMapboxMap]);

  useEffect(() => {
    return () => {
      tearDown();
    };
  }, [tearDown]);

  useEffect(() => {
    if (!accessToken) {
      setError(
        "Missing Mapbox access token. Set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN."
      );
      tearDown();
      return;
    }
    setError(null);
  }, [accessToken, tearDown]);

  useEffect(() => {
    if (!accessToken || !containerRef.current || mapRef.current) return;

    mapboxgl.accessToken = accessToken;
    const data = useSceneStore.getState().mapboxSceneData;

    try {
      const mapInstance = new mapboxgl.Map({
        container: containerRef.current,
        style: data.styleUrl || "mapbox://styles/mapbox/streets-v12",
        center: data.center,
        zoom: data.zoom,
        pitch: data.pitch,
        bearing: data.bearing,
        maxBounds: data.maxBounds
          ? [
              [data.maxBounds[0][0], data.maxBounds[0][1]],
              [data.maxBounds[1][0], data.maxBounds[1][1]],
            ]
          : undefined,
        attributionControl: true,
        antialias: true,
      });

      mapRef.current = mapInstance;
      setMap(mapInstance);
      setMapboxMap(mapInstance);

      mapInstance.on("error", (e) => {
        const msg = (e as { error?: { message?: string } }).error?.message;
        if (msg) setError(msg);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create map");
    }
  }, [accessToken, mapboxSceneData, setMapboxMap]);

  useEffect(() => {
    const m = mapRef.current;
    const el = containerRef.current;
    if (!m || !el) return;
    const ro = new ResizeObserver(() => {
      try {
        m.resize();
      } catch {
        /* ignore */
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);

  useEffect(() => {
    const m = mapRef.current;
    if (!m?.isStyleLoaded()) return;
    if (previewMode) return;

    const { center, zoom, pitch, bearing, maxBounds } = mapboxSceneData;
    try {
      m.setCenter(center);
      m.setZoom(zoom);
      m.setPitch(pitch);
      m.setBearing(bearing);
      if (maxBounds) {
        m.setMaxBounds([
          [maxBounds[0][0], maxBounds[0][1]],
          [maxBounds[1][0], maxBounds[1][1]],
        ]);
      } else {
        // Mapbox clears constraints when bounds are null; typings omit null.
        // @ts-expect-error runtime supports clearing max bounds
        m.setMaxBounds(null);
      }
    } catch {
      /* ignore */
    }
  }, [
    map,
    mapboxSceneData.center,
    mapboxSceneData.zoom,
    mapboxSceneData.pitch,
    mapboxSceneData.bearing,
    mapboxSceneData.maxBounds,
    previewMode,
  ]);

  useEffect(() => {
    const m = mapRef.current;
    if (!m || !mapboxSceneData.styleUrl) return;
    const run = () => {
      try {
        m.setStyle(mapboxSceneData.styleUrl);
      } catch {
        /* ignore */
      }
    };
    if (m.isStyleLoaded()) run();
    else m.once("load", run);
  }, [map, mapboxSceneData.styleUrl]);

  return { map, error, containerRef };
}
