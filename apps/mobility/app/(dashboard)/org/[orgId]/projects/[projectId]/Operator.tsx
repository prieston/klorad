"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import mapboxgl, { type Map as MapboxMap, type Marker } from "mapbox-gl";
import Link from "next/link";
import { toast } from "react-toastify";
import {
  ArrowUpRight,
  Bell,
  Camera,
  CheckCircle2,
  Compass,
  Database,
  Eye,
  Layers,
  MapPin,
  Radio,
  RefreshCcw,
  Signpost,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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

const MARKER_LEGEND = [
  { tone: "review", colour: "#facc15", label: "Needs review" },
  { tone: "public", colour: "#34d399", label: "On public map" },
  { tone: "included", colour: "#60a5fa", label: "Operator only" },
  { tone: "catalog", colour: "#94a3b8", label: "Catalogued" },
] as const;

/**
 * Operator console: full-bleed Mapbox + a 360px side drawer for the
 * selected device. Layout uses flex-col on mobile (map up top, drawer
 * below) and flex-row from md (map fills remaining width, drawer
 * sticks to 360px). Mapbox dimensions are tracked by a ResizeObserver
 * so the canvas can never get stuck at 0×0 after a layout shift.
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

  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());

  useEffect(() => {
    if (!mapboxToken || !mapEl.current || mapRef.current) return;
    mapboxgl.accessToken = mapboxToken;
    const map = new mapboxgl.Map({
      container: mapEl.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: THESS_CENTER,
      zoom: 11,
      attributionControl: false,
    });
    map.addControl(
      new mapboxgl.AttributionControl({ compact: true }),
      "bottom-right",
    );
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
    mapRef.current = map;
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(mapEl.current);
    return () => ro.disconnect();
  }, [mapboxToken]);

  // Sync markers with the device set on every refresh + curation change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const next = new Map<string, Marker>();
    for (const d of devices) {
      if (d.lat == null || d.lng == null) continue;
      const colour = d.needsReview
        ? "#facc15"
        : d.isPublic
          ? "#34d399"
          : d.included
            ? "#60a5fa"
            : "#94a3b8";
      const isSelected = d.id === selectedId;
      const existing = markersRef.current.get(d.id);
      const el = document.createElement("div");
      el.style.position = "relative";
      el.style.cursor = "pointer";
      el.title = d.customLabel ?? d.name;
      el.innerHTML = `
        <span style="
          position:absolute; inset:0; margin:auto;
          width:${isSelected ? 26 : 18}px; height:${isSelected ? 26 : 18}px;
          background:${colour}33; border-radius:9999px;
          transform: translate(-${isSelected ? 13 : 9}px, -${isSelected ? 13 : 9}px);
        "></span>
        <span style="
          position:relative;
          display:block;
          width:${isSelected ? 12 : 10}px; height:${isSelected ? 12 : 10}px;
          background:${colour};
          border-radius:9999px;
          box-shadow: 0 0 0 2px rgba(15, 23, 42, 0.65);
          transform: translate(-${isSelected ? 6 : 5}px, -${isSelected ? 6 : 5}px);
        "></span>
      `;
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        setSelectedId(d.id);
      });
      const marker = (
        existing ?? new mapboxgl.Marker({ element: el }).setLngLat([d.lng, d.lat])
      ).addTo(map);
      if (existing) {
        existing.setLngLat([d.lng, d.lat]);
        // Replace inner DOM to refresh selection / curation colour without
        // remounting the marker (avoids visual flicker on every SWR poll).
        existing.getElement().replaceWith(el);
        next.set(d.id, new mapboxgl.Marker({ element: el }).setLngLat([d.lng, d.lat]).addTo(map));
        existing.remove();
      } else {
        next.set(d.id, marker);
      }
    }
    for (const [id, marker] of markersRef.current) {
      if (!next.has(id)) marker.remove();
    }
    markersRef.current = next;
  }, [devices, selectedId]);

  // Pan the map smoothly to a selected marker the first time it lands.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selected || selected.lat == null || selected.lng == null) return;
    map.easeTo({
      center: [selected.lng, selected.lat],
      zoom: Math.max(map.getZoom(), 13),
      duration: 700,
    });
  }, [selected?.id, selected?.lat, selected?.lng]);

  return (
    <div className="flex h-full flex-col md:flex-row">
      <div className="relative h-[55dvh] overflow-hidden md:h-full md:flex-1">
        {mapboxToken ? (
          <div ref={mapEl} className="h-full w-full" />
        ) : (
          <div className="flex h-full items-center justify-center bg-surface-2 p-8 text-center text-sm text-text-tertiary">
            Set <code>NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code> in this
            environment to render the map.
          </div>
        )}
        <Legend devices={devices} />
        <SourcesChip href={sourcesHref} />
      </div>
      <aside className="w-full shrink-0 overflow-y-auto border-t border-line-soft bg-bg md:w-[360px] md:border-l md:border-t-0">
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

/* ─── Floating top-left legend ─────────────────────────────────────── */

function Legend({ devices }: { devices: DeviceRow[] }) {
  const placed = devices.filter((d) => d.lat != null && d.lng != null);
  const needsReview = devices.filter((d) => d.needsReview).length;
  const publicCount = devices.filter((d) => d.isPublic).length;
  return (
    <div className="pointer-events-auto absolute left-4 top-4 max-w-[260px] rounded-2xl border border-line-soft bg-bg/95 p-3 text-xs shadow-sm backdrop-blur">
      <div className="mb-2 flex items-center gap-2">
        <Layers size={12} strokeWidth={1.8} className="text-text-tertiary" aria-hidden />
        <span className="font-medium text-text-primary">
          {placed.length} / {devices.length} placed
        </span>
        {needsReview > 0 && (
          <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-yellow-600">
            {needsReview} new
          </span>
        )}
      </div>
      <ul className="space-y-1">
        {MARKER_LEGEND.map((row) => (
          <li
            key={row.tone}
            className="flex items-center gap-2 text-[11px] text-text-secondary"
          >
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-full"
              style={{
                backgroundColor: row.colour,
                boxShadow: `0 0 0 2px ${row.colour}33`,
              }}
            />
            <span className="truncate">{row.label}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 border-t border-line-soft pt-2 text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
        {publicCount} on traveller map
      </p>
    </div>
  );
}

/* ─── Floating top-right "Sources" link ────────────────────────────── */

function SourcesChip({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="pointer-events-auto absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-line-soft bg-bg/95 px-3.5 py-2 text-xs font-medium text-text-primary shadow-sm backdrop-blur transition-colors hover:border-accent hover:text-accent"
    >
      <Database size={12} strokeWidth={1.8} aria-hidden />
      Data sources
      <ArrowUpRight size={11} strokeWidth={1.8} aria-hidden />
    </Link>
  );
}

/* ─── Empty / idle drawer ──────────────────────────────────────────── */

function NoSelection({
  devices,
  sourcesHref,
}: {
  devices: DeviceRow[];
  sourcesHref: string;
}) {
  if (devices.length === 0) {
    return (
      <div className="flex h-full flex-col items-start justify-center gap-4 p-6">
        <span className="inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.28em] text-text-tertiary">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
          Operator console
        </span>
        <h2 className="text-2xl font-light leading-tight text-text-primary">
          No devices yet.
        </h2>
        <p className="text-sm text-text-secondary">
          Add a data source, then run Sync to populate this map with your
          fleet.
        </p>
        <Link
          href={sourcesHref}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90"
        >
          <Database size={14} strokeWidth={1.8} />
          Go to sources
        </Link>
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col items-start justify-center gap-4 p-6">
      <span className="inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.28em] text-text-tertiary">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
        Operator console
      </span>
      <h2 className="text-2xl font-light leading-tight text-text-primary">
        Pick a device.
      </h2>
      <p className="text-sm text-text-secondary">
        Click any marker to inspect status, watch the live feed, render the
        sign face, or change its curation.
      </p>
    </div>
  );
}

/* ─── Device drawer ────────────────────────────────────────────────── */

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

  const subsystemIcon: LucideIcon =
    device.subsystem === "cctv" ? Camera : device.subsystem === "dms" ? Signpost : Radio;
  const SubsystemIcon = subsystemIcon;

  return (
    <div className="flex h-full flex-col">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="flex items-start justify-between gap-3 border-b border-line-soft p-6">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-text-tertiary">
            <SubsystemIcon size={10} strokeWidth={2} aria-hidden />
            {device.subsystem}
            {device.type && ` · ${device.type}`}
          </span>
          <h2 className="mt-2 truncate text-lg font-medium leading-tight text-text-primary">
            {device.customLabel ?? device.name}
          </h2>
          {device.customLabel && (
            <p className="mt-0.5 truncate text-xs text-text-tertiary">
              {device.name}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close drawer"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-surface-2 hover:text-text-primary"
        >
          <X size={14} strokeWidth={1.8} />
        </button>
      </header>

      {/* ── Locator ────────────────────────────────────────────────── */}
      <section className="border-b border-line-soft p-6">
        <SectionEyebrow icon={MapPin}>Locator</SectionEyebrow>
        <dl className="mt-3 space-y-2 text-xs">
          {device.primaryRoad ? (
            <Row label="Road">
              {device.primaryRoad}
              {device.crossRoad ? (
                <span className="text-text-tertiary"> × {device.crossRoad}</span>
              ) : null}
              {device.direction ? (
                <span className="ml-1.5 rounded-full bg-surface-2 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.18em] text-text-tertiary">
                  {device.direction}
                </span>
              ) : null}
            </Row>
          ) : null}
          {device.agency ? <Row label="Agency">{device.agency}</Row> : null}
          {device.lat != null && device.lng != null ? (
            <Row label="Coords">
              <code className="font-mono text-[11px] text-text-secondary">
                {device.lat.toFixed(5)}, {device.lng.toFixed(5)}
              </code>
            </Row>
          ) : null}
          <Row label="External id">
            <code className="font-mono text-[11px] text-text-secondary">
              {device.externalDeviceId}
            </code>
          </Row>
        </dl>
      </section>

      {/* ── Live status ─────────────────────────────────────────────── */}
      <section className="border-b border-line-soft p-6">
        <div className="mb-3 flex items-center justify-between gap-2">
          <SectionEyebrow icon={Radio}>Live status</SectionEyebrow>
          <span
            aria-hidden
            className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-text-tertiary"
            title="Auto-refresh every 15 seconds"
          >
            <RefreshCcw size={10} strokeWidth={1.8} />
            15 s
          </span>
        </div>
        {isLoading && !live ? (
          <p className="text-sm text-text-tertiary">Fetching…</p>
        ) : !live?.status ? (
          <p className="text-sm text-text-tertiary">
            No live data — the source returned no current status.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill online={live.status.online} />
              {live.status.alarm && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-red-600">
                  <Bell size={9} strokeWidth={2.2} />
                  {live.status.alarm}
                </span>
              )}
              <span className="ml-auto text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
                {relativeFrom(live.status.observedAt)}
              </span>
            </div>

            {/* DMS face */}
            {device.subsystem === "dms" &&
              typeof live.status.raw.message === "string" && (
                <div className="rounded-xl border border-line-soft bg-black p-3">
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

            {/* CCTV stream */}
            {device.subsystem === "cctv" &&
              payload.media?.kind === "cctv-stream" && (
                <div className="overflow-hidden rounded-xl border border-line-soft bg-black">
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

      {/* ── Curation ────────────────────────────────────────────────── */}
      <section className="border-b border-line-soft bg-surface-2 p-6">
        <SectionEyebrow icon={Eye}>Curation</SectionEyebrow>
        <p className="mt-1 mb-4 text-xs text-text-secondary">
          What the operator team sees and what reaches the public traveller map.
        </p>
        <div className="space-y-3">
          <ToggleRow
            label="Include in operator console"
            description="Show this device on the operator map and in alert feeds."
            checked={device.included}
            onChange={(next) => curate({ included: next })}
          />
          <ToggleRow
            label="Show on public traveller map"
            description="Anonymous visitors at /m see this device when the project is published."
            checked={device.isPublic}
            onChange={(next) => curate({ isPublic: next })}
          />
        </div>
        {device.needsReview && (
          <button
            type="button"
            onClick={() => curate({ needsReview: false })}
            className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-line-strong bg-bg px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:border-accent hover:text-accent"
          >
            <CheckCircle2 size={12} strokeWidth={1.8} />
            Mark as reviewed
          </button>
        )}
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="mt-auto p-6 text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
        Last seen {relativeFrom(device.lastSeenAt)}
      </footer>
    </div>
  );
}

/* ─── Small primitives reused across the drawer ────────────────────── */

function SectionEyebrow({
  children,
  icon: Icon,
}: {
  children: React.ReactNode;
  icon: LucideIcon;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.22em] text-text-tertiary">
      <Icon size={10} strokeWidth={1.8} aria-hidden />
      {children}
    </span>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[80px_1fr] gap-2">
      <dt className="text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
        {label}
      </dt>
      <dd className="min-w-0 text-text-primary">{children}</dd>
    </div>
  );
}

function StatusPill({ online }: { online: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] ${
        online
          ? "bg-emerald-500/10 text-emerald-600"
          : "bg-red-500/10 text-red-600"
      }`}
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${
          online ? "bg-emerald-500" : "bg-red-500"
        }`}
      />
      {online ? "Online" : "Offline"}
    </span>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <div className="min-w-0">
        <span className="text-sm font-medium text-text-primary">{label}</span>
        <p className="mt-0.5 text-[11px] leading-relaxed text-text-secondary">
          {description}
        </p>
      </div>
      <Switch checked={checked} onChange={onChange} />
    </label>
  );
}

function Switch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
        checked ? "bg-accent" : "border border-line-strong bg-bg"
      }`}
    >
      <span
        aria-hidden
        className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

/* ─── Helpers ──────────────────────────────────────────────────────── */

function relativeFrom(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "—";
  const diff = Date.now() - ts;
  if (diff < 0) return "just now";
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

/* Suppress an unused-import warning for icons reserved for future
 * drawer sections without polluting the JSX above. */
export const _reservedIcons = { Compass };
