"use client";

import { useEffect, useState } from "react";
import type { Map as MapboxMap, GeoJSONSource } from "mapbox-gl";
import { IconButton, Tooltip, CircularProgress } from "@mui/material";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import LocationSearchingIcon from "@mui/icons-material/LocationSearching";
import { useSceneStore } from "@klorad/core";

const SOURCE_ID = "campus-user-location";
const RING_LAYER_ID = "campus-user-location-ring";
const DOT_LAYER_ID = "campus-user-location-dot";

interface Props {
  /** Optional custom sx overrides. */
  size?: number;
  /** Distance from right edge. */
  right?: number;
  /** Distance from bottom edge. */
  bottom?: number;
}

/**
 * Floating action button that fetches the browser's geolocation and
 * drops a pulsing blue dot on the map. Tapping again re-centers the
 * camera on the last known position.
 */
export default function WhereAmIButton({
  size = 52,
  right = 16,
  bottom = 16,
}: Props) {
  const map = useSceneStore((s) => s.mapboxMap as MapboxMap | null);
  const [loading, setLoading] = useState(false);
  const [located, setLocated] = useState<[number, number] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    if (!map) return;
    if (!("geolocation" in navigator)) {
      setError("Geolocation unsupported");
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coord: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        setLocated(coord);
        map.flyTo({
          center: coord,
          zoom: Math.max(map.getZoom(), 17),
          duration: 1200,
          essential: true,
        });
        setLoading(false);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Render the dot whenever we have a located coord
  useEffect(() => {
    if (!map || !located) return;
    const install = () => {
      if (!map.isStyleLoaded()) return;
      const data: GeoJSON.Feature = {
        type: "Feature",
        geometry: { type: "Point", coordinates: located },
        properties: {},
      };
      if (map.getSource(SOURCE_ID)) {
        (map.getSource(SOURCE_ID) as GeoJSONSource).setData(data);
      } else {
        map.addSource(SOURCE_ID, { type: "geojson", data });
      }
      if (!map.getLayer(RING_LAYER_ID)) {
        map.addLayer({
          id: RING_LAYER_ID,
          type: "circle",
          source: SOURCE_ID,
          paint: {
            "circle-radius": 18,
            "circle-color": "#6b9cd8",
            "circle-opacity": 0.2,
            "circle-blur": 0.5,
          },
        });
      }
      if (!map.getLayer(DOT_LAYER_ID)) {
        map.addLayer({
          id: DOT_LAYER_ID,
          type: "circle",
          source: SOURCE_ID,
          paint: {
            "circle-radius": 7,
            "circle-color": "#6b9cd8",
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
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
      try {
        if (map.getLayer(DOT_LAYER_ID)) map.removeLayer(DOT_LAYER_ID);
        if (map.getLayer(RING_LAYER_ID)) map.removeLayer(RING_LAYER_ID);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      } catch {
        /* ignore */
      }
    };
  }, [map, located]);

  return (
    <Tooltip title={error ?? "Where am I"} placement="left" arrow>
      <IconButton
        onClick={handleClick}
        disabled={loading}
        sx={{
          position: "fixed",
          right,
          bottom,
          width: size,
          height: size,
          zIndex: 1401,
          bgcolor: "var(--glass-bg)",
          border: "1px solid var(--glass-border)",
          backdropFilter: "blur(24px) saturate(140%)",
          WebkitBackdropFilter: "blur(24px) saturate(140%)",
          boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
          color: located ? "primary.main" : "text.primary",
          "&:hover": {
            bgcolor: "var(--glass-bg)",
            color: "primary.main",
          },
        }}
      >
        {loading ? (
          <CircularProgress size={20} />
        ) : located ? (
          <MyLocationIcon />
        ) : (
          <LocationSearchingIcon />
        )}
      </IconButton>
    </Tooltip>
  );
}
