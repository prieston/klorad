"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl, { type Map as MapboxMap, type Marker } from "mapbox-gl";
import { Maximize2 } from "lucide-react";
import type { CampusMap } from "@/app/hooks/useMaps";

interface Props {
  maps: CampusMap[];
  /** Tailwind height — overridable so the same component fits a hero
   *  banner (taller) or a sidebar widget. */
  className?: string;
}

const FALLBACK_CENTER: [number, number] = [23.7275, 37.9838]; // Athens
const FALLBACK_ZOOM = 4;
// Brand accent — mirrors `--accent` in the tokens.css palette.
const PIN_COLOR = "#158ca3";

/**
 * The Org Overview's world map — one pin per campus that has a stored
 * `center` coordinate. The only surviving Mapbox surface in the
 * product per [[campus-indoor-mappedin-decision]]; everything inside
 * a single campus uses MappedIn.
 *
 * Lives in the dashboard chrome only — public surfaces never embed
 * this. The map is non-interactive enough for an overview (cooperative
 * gestures, no scroll-zoom hijack) and zooms to fit on prop change so
 * adding a campus immediately reframes.
 *
 * Renders a "set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN" hint instead of
 * silently failing when the token isn't configured — the dashboard
 * is rector-facing, so being explicit about the gap beats a blank
 * box.
 */
export function OrgWorldMap({ maps, className = "h-[260px]" }: Props) {
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
      map.flyTo({
        center: FALLBACK_CENTER,
        zoom: FALLBACK_ZOOM,
        duration: 800,
      });
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
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-line-soft bg-surface-1 ${className}`}
    >
      <div ref={containerRef} className="absolute inset-0" />
      {!hasToken && (
        <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-text-secondary">
          Set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to see campus locations.
        </div>
      )}
      <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full border border-line-soft bg-surface-1/90 px-3 py-1.5 text-xs font-medium text-text-primary shadow-sm backdrop-blur">
        <span>Campus locations</span>
        <span className="inline-flex items-center rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent">
          {pins.length}
        </span>
      </div>
      <button
        type="button"
        onClick={fitToExtent}
        disabled={pins.length === 0}
        aria-label="Fit to extent"
        className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-line-soft bg-surface-1/90 px-3 py-1.5 text-xs font-medium text-text-primary shadow-sm backdrop-blur transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        <Maximize2 size={12} strokeWidth={1.75} aria-hidden />
        Fit
      </button>
    </div>
  );
}
