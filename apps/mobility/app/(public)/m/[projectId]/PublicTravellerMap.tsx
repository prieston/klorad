"use client";

import { useEffect, useMemo, useRef } from "react";
import useSWR from "swr";
import mapboxgl, { type Map as MapboxMap, type Marker } from "mapbox-gl";

interface PublicDeviceRow {
  id: string;
  externalDeviceId: string;
  subsystem: string;
  name: string;
  type: string | null;
  lat: number | null;
  lng: number | null;
  primaryRoad: string | null;
  crossRoad: string | null;
  direction: string | null;
  customLabel: string | null;
}

interface PublicDevicesResponse {
  devices: PublicDeviceRow[];
}

const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  });

const THESS_CENTER: [number, number] = [22.9444, 40.6401];

/**
 * Anonymous traveller map. No drawer, no curation, no live status
 * proxy (a visitor doesn't need 15-second polling and we don't want
 * to burn ATMS rate limits on anonymous traffic). Each marker shows
 * the device's label on click; that's it.
 */
export function PublicTravellerMap({
  projectId,
  projectTitle,
  mapboxToken,
}: {
  projectId: string;
  projectTitle: string;
  mapboxToken: string | null;
}) {
  const { data } = useSWR<PublicDevicesResponse>(
    `/api/public/projects/${projectId}/devices`,
    fetcher,
    { refreshInterval: 60_000 },
  );
  const devices = useMemo(() => data?.devices ?? [], [data]);

  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());

  useEffect(() => {
    if (!mapboxToken || !mapEl.current || mapRef.current) return;
    mapboxgl.accessToken = mapboxToken;
    mapRef.current = new mapboxgl.Map({
      container: mapEl.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: THESS_CENTER,
      zoom: 11,
    });
  }, [mapboxToken]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const next = new Map<string, Marker>();
    for (const d of devices) {
      if (d.lat == null || d.lng == null) continue;
      const existing = markersRef.current.get(d.id);
      const el = document.createElement("div");
      el.style.background = "#0ea5e9";
      el.style.width = "10px";
      el.style.height = "10px";
      el.style.borderRadius = "9999px";
      el.style.boxShadow = "0 0 0 2px white";
      el.title = d.customLabel ?? d.name;
      const marker = (
        existing ?? new mapboxgl.Marker({ element: el }).setLngLat([d.lng, d.lat])
      ).addTo(map);
      if (existing) existing.setLngLat([d.lng, d.lat]);
      next.set(d.id, marker);
    }
    for (const [id, marker] of markersRef.current) {
      if (!next.has(id)) marker.remove();
    }
    markersRef.current = next;
  }, [devices]);

  return (
    <main className="relative h-[100dvh] w-full">
      {mapboxToken ? (
        <div ref={mapEl} className="absolute inset-0" />
      ) : (
        <div className="flex h-full items-center justify-center bg-surface-2 p-8 text-center text-sm text-text-tertiary">
          The map is not available.
        </div>
      )}
      <div className="pointer-events-none absolute left-4 top-4 rounded-xl border border-line-soft bg-bg/95 px-4 py-3 text-xs shadow-sm">
        <p className="font-medium text-text-primary">{projectTitle}</p>
        <p className="text-text-tertiary">{devices.length} devices</p>
      </div>
    </main>
  );
}
