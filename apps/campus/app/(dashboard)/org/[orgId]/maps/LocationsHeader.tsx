"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import CenterFocusStrongIcon from "@mui/icons-material/CenterFocusStrong";
import mapboxgl, { type Map as MapboxMap, type Marker } from "mapbox-gl";
import { Button } from "@klorad/design-system";
import type { CampusMap } from "@/app/hooks/useMaps";

interface Props {
  maps: CampusMap[];
}

const FALLBACK_CENTER: [number, number] = [23.7275, 37.9838]; // Athens
const FALLBACK_ZOOM = 4;
// Brand accent — constant across themes (mirrors --accent in tokens.css).
const PIN_COLOR = "#158ca3";

export default function LocationsHeader({ maps }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [ready, setReady] = useState(false);

  const pins = useMemo(
    () =>
      maps
        .filter(
          (m): m is CampusMap & { center: [number, number] } =>
            Array.isArray(m.center) &&
            typeof m.center[0] === "number" &&
            typeof m.center[1] === "number",
        )
        .map((m) => ({ id: m.id, name: m.name, center: m.center })),
    [maps],
  );

  const fitToExtent = () => {
    const map = mapRef.current;
    if (!map) return;
    if (pins.length === 0) {
      map.flyTo({ center: FALLBACK_CENTER, zoom: FALLBACK_ZOOM, duration: 800 });
      return;
    }
    if (pins.length === 1) {
      map.flyTo({ center: pins[0].center, zoom: 14, duration: 800 });
      return;
    }
    const bounds = new mapboxgl.LngLatBounds(pins[0].center, pins[0].center);
    for (const p of pins) bounds.extend(p.center);
    map.fitBounds(bounds, { padding: 48, duration: 800, maxZoom: 15 });
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!token) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: FALLBACK_CENTER,
      zoom: FALLBACK_ZOOM,
      attributionControl: false,
      interactive: true,
      cooperativeGestures: true,
    });
    map.on("load", () => setReady(true));
    mapRef.current = map;
    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    for (const pin of pins) {
      const el = document.createElement("div");
      el.style.width = "14px";
      el.style.height = "14px";
      el.style.borderRadius = "50%";
      el.style.background = PIN_COLOR;
      el.style.border = "2px solid #fff";
      el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.35)";
      el.title = pin.name;
      const marker = new mapboxgl.Marker(el)
        .setLngLat(pin.center)
        .addTo(mapRef.current);
      markersRef.current.push(marker);
    }

    fitToExtent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, ready]);

  const hasToken = Boolean(process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN);

  return (
    <div className="relative mb-6 h-[200px] w-full overflow-hidden rounded-2xl border border-line-soft bg-surface-1">
      <div ref={containerRef} className="absolute inset-0" />
      {!hasToken && (
        <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-text-secondary">
          Set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to see campus locations on a map.
        </div>
      )}
      <div className="glass-panel absolute left-3 top-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-text-primary">
        <span>Campus locations</span>
        <span className="inline-flex items-center rounded-full bg-accent-soft px-2 py-0.5 text-[0.7rem] font-semibold text-accent">
          {pins.length}
        </span>
      </div>
      <Button
        size="sm"
        onClick={fitToExtent}
        disabled={pins.length === 0}
        className="absolute right-3 top-3"
      >
        <CenterFocusStrongIcon sx={{ fontSize: 16 }} />
        Fit to extent
      </Button>
    </div>
  );
}
