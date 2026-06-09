"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import mapboxgl, { type Map as MapboxMap, type Marker } from "mapbox-gl";
import Link from "next/link";
import { toast } from "react-toastify";
import { DmsFace } from "@/lib/mobility/dms-render";

interface DeviceRow {
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
  agency: string | null;
  payload: Record<string, unknown>;
  included: boolean;
  isPublic: boolean;
  customLabel: string | null;
  needsReview: boolean;
  sourceId: string;
  lastSeenAt: string;
}

interface DevicesResponse {
  devices: DeviceRow[];
}

interface LiveResponse {
  status: {
    online: boolean;
    alarm: string | null;
    observedAt: string;
    raw: Record<string, unknown>;
  } | null;
}

const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  });

const THESS_CENTER: [number, number] = [22.9444, 40.6401];

/**
 * Operator console — map of devices + drawer for the selected one.
 *
 * The map renders all devices that have lat/lng. Selected device gets
 * an inline drawer with name + status (proxied through the connector
 * live), curation toggles, the DMS face (when applicable), and a
 * placeholder for the camera (HLS player lands in a follow-up).
 */
export function Operator({
  projectId,
  mapboxToken,
  sourcesHref,
}: {
  projectId: string;
  mapboxToken: string | null;
  sourcesHref: string;
}) {
  const { data, mutate } = useSWR<DevicesResponse>(
    `/api/projects/${projectId}/devices`,
    fetcher,
    { refreshInterval: 30_000 },
  );
  const devices = useMemo(() => data?.devices ?? [], [data]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => devices.find((d) => d.id === selectedId) ?? null,
    [devices, selectedId],
  );

  // Map
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());

  useEffect(() => {
    if (!mapboxToken || !mapEl.current || mapRef.current) return;
    mapboxgl.accessToken = mapboxToken;
    mapRef.current = new mapboxgl.Map({
      container: mapEl.current,
      style: "mapbox://styles/mapbox/dark-v11",
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
      const colour = d.needsReview
        ? "#facc15"
        : d.isPublic
          ? "#34d399"
          : d.included
            ? "#60a5fa"
            : "#94a3b8";
      const el = document.createElement("div");
      el.style.background = colour;
      el.style.width = "12px";
      el.style.height = "12px";
      el.style.borderRadius = "9999px";
      el.style.boxShadow = "0 0 0 2px rgba(15, 23, 42, 0.7)";
      el.style.cursor = "pointer";
      el.title = d.customLabel ?? d.name;
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        setSelectedId(d.id);
      });
      const marker = (
        existing ?? new mapboxgl.Marker({ element: el }).setLngLat([d.lng, d.lat])
      ).addTo(map);
      if (existing) {
        existing.setLngLat([d.lng, d.lat]);
      }
      next.set(d.id, marker);
    }
    // Remove markers that disappeared.
    for (const [id, marker] of markersRef.current) {
      if (!next.has(id)) marker.remove();
    }
    markersRef.current = next;
  }, [devices]);

  return (
    <div className="grid h-[calc(100dvh-1px)] grid-cols-1 md:grid-cols-[minmax(0,1fr)_360px]">
      <div className="relative">
        {mapboxToken ? (
          <div ref={mapEl} className="absolute inset-0" />
        ) : (
          <div className="flex h-full items-center justify-center bg-surface-2 p-8 text-center text-sm text-text-tertiary">
            Set <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> in this environment
            to render the map.
          </div>
        )}
        <Legend devices={devices} sourcesHref={sourcesHref} />
      </div>
      <aside className="overflow-y-auto border-l border-line-soft bg-bg p-6">
        {selected ? (
          <DeviceDrawer
            device={selected}
            onCurated={() => void mutate()}
            onClose={() => setSelectedId(null)}
          />
        ) : (
          <NoSelection devices={devices} sourcesHref={sourcesHref} />
        )}
      </aside>
    </div>
  );
}

function Legend({
  devices,
  sourcesHref,
}: {
  devices: DeviceRow[];
  sourcesHref: string;
}) {
  const placed = devices.filter((d) => d.lat != null && d.lng != null);
  const needsReview = devices.filter((d) => d.needsReview).length;
  return (
    <div className="pointer-events-auto absolute left-4 top-4 rounded-xl border border-line-soft bg-bg/95 px-4 py-3 text-xs shadow-sm">
      <div className="flex items-center gap-4">
        <span className="font-medium text-text-primary">
          {placed.length} / {devices.length} placed
        </span>
        {needsReview > 0 && (
          <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-yellow-600">
            {needsReview} new
          </span>
        )}
        <Link
          href={sourcesHref}
          className="ml-2 text-accent hover:text-accent-hover"
        >
          Sources →
        </Link>
      </div>
    </div>
  );
}

function NoSelection({
  devices,
  sourcesHref,
}: {
  devices: DeviceRow[];
  sourcesHref: string;
}) {
  if (devices.length === 0) {
    return (
      <div className="space-y-4 text-sm text-text-tertiary">
        <p>No devices yet. Run a sync from the Sources screen.</p>
        <Link
          href={sourcesHref}
          className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-contrast transition-colors hover:bg-accent-hover"
        >
          Go to Sources
        </Link>
      </div>
    );
  }
  return (
    <p className="text-sm text-text-tertiary">
      Click a marker on the map to inspect.
    </p>
  );
}

function DeviceDrawer({
  device,
  onCurated,
  onClose,
}: {
  device: DeviceRow;
  onCurated: () => void;
  onClose: () => void;
}) {
  const { data: live, isLoading } = useSWR<LiveResponse>(
    `/api/devices/${device.id}/live`,
    fetcher,
    { refreshInterval: 15_000 },
  );

  const curate = async (patch: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/devices/${device.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(await res.text());
      onCurated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  };

  const payload = device.payload as {
    media?:
      | { kind: "cctv-stream"; url: string; streamType: "hls" | "mp4" }
      | { kind: "dms-image-list"; path: string }
      | null;
  };

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-xs uppercase tracking-[0.18em] text-text-tertiary">
            {device.subsystem}
            {device.type && ` · ${device.type}`}
          </span>
          <h2 className="mt-1 text-xl font-medium text-text-primary">
            {device.customLabel ?? device.name}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-text-tertiary hover:text-text-primary"
        >
          ✕
        </button>
      </header>

      <section className="space-y-1 text-xs text-text-secondary">
        {device.primaryRoad && (
          <p>
            <span className="text-text-tertiary">Road:</span>{" "}
            {device.primaryRoad}
            {device.crossRoad && ` × ${device.crossRoad}`}
            {device.direction && ` (${device.direction})`}
          </p>
        )}
        {device.agency && (
          <p>
            <span className="text-text-tertiary">Agency:</span> {device.agency}
          </p>
        )}
        <p>
          <span className="text-text-tertiary">External id:</span>{" "}
          {device.externalDeviceId}
        </p>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-text-tertiary">
          Live status
        </h3>
        {isLoading && !live ? (
          <p className="text-sm text-text-tertiary">Fetching…</p>
        ) : !live?.status ? (
          <p className="text-sm text-text-tertiary">No live data.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm">
              <span
                className={`inline-flex h-2 w-2 rounded-full ${
                  live.status.online ? "bg-emerald-500" : "bg-red-500"
                }`}
                aria-hidden
              />{" "}
              <span className="text-text-primary">
                {live.status.online ? "Online" : "Offline"}
              </span>
              {live.status.alarm && (
                <span className="ml-2 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-red-600">
                  {live.status.alarm}
                </span>
              )}
            </p>
            <p className="text-xs text-text-tertiary">
              Observed {new Date(live.status.observedAt).toLocaleString()}
            </p>
            {device.subsystem === "dms" &&
              typeof live.status.raw.message === "string" && (
                <div className="mt-3">
                  <DmsFace
                    multi={live.status.raw.message}
                    maxLinesPerPage={
                      typeof live.status.raw.maxLinesPerPage === "number"
                        ? live.status.raw.maxLinesPerPage
                        : 3
                    }
                    maxCharsPerLine={
                      typeof live.status.raw.maxCharsPerLine === "number"
                        ? live.status.raw.maxCharsPerLine
                        : 16
                    }
                    brightness={
                      typeof live.status.raw.brightness === "number"
                        ? live.status.raw.brightness
                        : 100
                    }
                  />
                </div>
              )}
            {device.subsystem === "cctv" &&
              payload.media?.kind === "cctv-stream" && (
                <div className="mt-3 overflow-hidden rounded-md border border-line-soft bg-black">
                  {/* HLS works natively on Safari; Chrome needs hls.js
                      (planned). For now the URL is shown so the operator
                      can pop it into a player. */}
                  <video
                    src={payload.media.url}
                    controls
                    playsInline
                    muted
                    className="aspect-video w-full"
                  />
                </div>
              )}
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-xl bg-surface-2 p-4">
        <h3 className="text-xs font-medium uppercase tracking-[0.18em] text-text-tertiary">
          Curation
        </h3>
        <label className="flex items-center justify-between text-sm text-text-primary">
          <span>Included (operator console)</span>
          <input
            type="checkbox"
            checked={device.included}
            onChange={(e) => curate({ included: e.target.checked })}
          />
        </label>
        <label className="flex items-center justify-between text-sm text-text-primary">
          <span>Public (traveller map)</span>
          <input
            type="checkbox"
            checked={device.isPublic}
            onChange={(e) => curate({ isPublic: e.target.checked })}
          />
        </label>
        {device.needsReview && (
          <button
            type="button"
            onClick={() => curate({ needsReview: false })}
            className="w-full rounded-md border border-line-strong px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-accent hover:text-accent"
          >
            Mark as reviewed
          </button>
        )}
      </section>
    </div>
  );
}
