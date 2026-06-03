"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl, { type Map as MapboxMap, type Marker } from "mapbox-gl";
import { MapPin, Search } from "lucide-react";
import { Field, Input } from "@klorad/design-system";

interface Props {
  /** Stored as `[lng, lat]`, matching the rest of the app. `null` = not set. */
  value: [number, number] | null;
  onChange: (next: [number, number] | null) => void;
}

const FALLBACK_CENTER: [number, number] = [23.7275, 37.9838]; // Athens
const FALLBACK_ZOOM = 4;
const PIN_COLOR = "#158ca3";
const SEARCH_DEBOUNCE_MS = 250;

interface GeocodeFeature {
  id: string;
  place_name: string;
  center: [number, number];
}

/**
 * Map-based location picker on the Identity screen — the only place
 * the rector actually sets a campus's geographic coordinate. Mirrors
 * the same `sceneData.mapboxScene.center` field the org-tier world
 * map reads on the dashboard, so a save here lights up the pin
 * straight away.
 *
 * Three ways to set the pin:
 *   1. Type an address / venue / city — first match wins; arrow-keys
 *      navigate the suggestion list, Enter / click commits.
 *   2. Drag the pin on the inline mini-map.
 *   3. Click anywhere on the map.
 *
 * Why not pull this from the Workbench's 3D scene like before? The
 * Workbench is opt-in (some rectors only ever upload a logo and a
 * MappedIn id); coordinates would never get written without a
 * dedicated form. See USER-PATH.md §A5.
 */
export function LocationPicker({ value, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const lastValueRef = useRef<[number, number] | null>(null);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeFeature[]>([]);
  const [searching, setSearching] = useState(false);
  const [focused, setFocused] = useState(false);

  const token =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
      : undefined;

  // Mount the Mapbox instance exactly once. The marker is recreated
  // when `value` flips between set/unset; in-place updates use
  // `setLngLat`.
  useEffect(() => {
    if (!containerRef.current || mapRef.current || !token) return;
    mapboxgl.accessToken = token;
    const initialCenter = value ?? FALLBACK_CENTER;
    const initialZoom = value ? 14 : FALLBACK_ZOOM;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: initialCenter,
      zoom: initialZoom,
      attributionControl: false,
      interactive: true,
      cooperativeGestures: true,
    });
    map.on("load", () => setReady(true));
    map.on("click", (e) => {
      onChange([e.lngLat.lng, e.lngLat.lat]);
    });
    mapRef.current = map;
    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // We intentionally do not re-run on value/onChange changes —
    // see effects below for those.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Sync the marker (and recentre) when `value` changes — including
  // when the parent clears it. Using a ref to compare the previous
  // value avoids fluttering the map on no-op re-renders.
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const prev = lastValueRef.current;
    lastValueRef.current = value;
    if (!value) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (!markerRef.current) {
      const el = document.createElement("div");
      el.style.width = "16px";
      el.style.height = "16px";
      el.style.borderRadius = "50%";
      el.style.background = PIN_COLOR;
      el.style.border = "2px solid #fff";
      el.style.boxShadow = "0 1px 6px rgba(0,0,0,0.35)";
      el.style.cursor = "grab";
      const marker = new mapboxgl.Marker({ element: el, draggable: true })
        .setLngLat(value)
        .addTo(mapRef.current);
      marker.on("dragend", () => {
        const { lng, lat } = marker.getLngLat();
        onChange([lng, lat]);
      });
      markerRef.current = marker;
    } else {
      markerRef.current.setLngLat(value);
    }
    // Recentre only when the value actually moved meaningfully — not
    // when the parent passes through the same coords during a sibling
    // re-render. Threshold is ~10m, well below pin-drag resolution.
    if (
      !prev ||
      Math.abs(prev[0] - value[0]) > 0.0001 ||
      Math.abs(prev[1] - value[1]) > 0.0001
    ) {
      mapRef.current.flyTo({ center: value, zoom: 14, duration: 600 });
    }
  }, [value, ready, onChange]);

  // Mapbox Geocoding API, REST. No SDK — one fetch, debounced. We
  // ship the first 5 matches; the list closes on selection or blur.
  useEffect(() => {
    if (!token) return;
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setResults([]);
      return;
    }
    const handle = window.setTimeout(async () => {
      setSearching(true);
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          trimmed,
        )}.json?access_token=${token}&autocomplete=true&limit=5&types=address,place,poi,locality,neighborhood`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("geocode failed");
        const body = (await res.json()) as { features?: GeocodeFeature[] };
        setResults(body.features ?? []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [query, token]);

  const handlePickResult = (feature: GeocodeFeature) => {
    onChange(feature.center);
    setQuery(feature.place_name);
    setResults([]);
    setFocused(false);
  };

  if (!token) {
    return (
      <div className="rounded-xl border border-line-soft bg-surface-2/40 p-4 text-xs text-text-tertiary">
        Set <code>NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code> to enable the
        location picker.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Field label="Address or place">
        <div className="relative">
          <div className="relative">
            <Search
              size={14}
              strokeWidth={1.75}
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              // Delay blur so a click on a suggestion lands before
              // the list unmounts.
              onBlur={() => window.setTimeout(() => setFocused(false), 120)}
              placeholder="International Hellenic University, Thermi"
              className="!pl-9"
            />
          </div>
          {focused && results.length > 0 ? (
            <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-line-soft bg-surface-1 shadow-lg">
              {results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handlePickResult(r);
                  }}
                  className="block w-full truncate px-3 py-2 text-left text-xs text-text-primary transition-colors hover:bg-surface-2"
                >
                  {r.place_name}
                </button>
              ))}
            </div>
          ) : null}
          {searching && focused ? (
            <p className="mt-1 text-[11px] text-text-tertiary">Searching…</p>
          ) : null}
        </div>
      </Field>

      <div className="relative h-[280px] w-full overflow-hidden rounded-xl border border-line-soft bg-surface-1">
        <div ref={containerRef} className="absolute inset-0" />
        {value ? (
          <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-line-soft bg-surface-1/90 px-2.5 py-1 font-mono text-[10px] text-text-secondary shadow-sm backdrop-blur">
            <MapPin size={11} strokeWidth={1.75} aria-hidden />
            {value[1].toFixed(4)}, {value[0].toFixed(4)}
          </div>
        ) : null}
        {!value && ready ? (
          <div className="pointer-events-none absolute inset-x-3 bottom-3 rounded-md bg-surface-1/95 px-3 py-2 text-center text-[11px] text-text-tertiary shadow-sm backdrop-blur">
            Click the map or pick a place above to drop a pin.
          </div>
        ) : null}
      </div>

      {value ? (
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setQuery("");
          }}
          className="text-[11px] font-medium text-text-tertiary underline-offset-2 hover:text-text-primary hover:underline"
        >
          Clear location
        </button>
      ) : null}
    </div>
  );
}
