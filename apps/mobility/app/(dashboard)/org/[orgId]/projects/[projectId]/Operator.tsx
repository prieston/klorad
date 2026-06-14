"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import mapboxgl, {
  type GeoJSONSource,
  type Map as MapboxMap,
  type MapMouseEvent,
} from "mapbox-gl";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "react-toastify";
import {
  ArrowUpRight,
  Bell,
  Box,
  Camera,
  CheckCircle2,
  Compass,
  Copy,
  Database,
  Eye,
  ExternalLink,
  Layers,
  MapPin,
  Moon,
  Mountain,
  Radio,
  RefreshCcw,
  Settings,
  Signpost,
  Sun,
  Sunrise,
  Sunset,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { DmsFace } from "@/lib/mobility/dms-render";
import {
  applyMapEnvSettings,
  loadMapEnvSettings,
  saveMapEnvSettings,
  MAP_STYLES,
  MAP_STYLE_LIST,
  type MapEnvSettings,
  type MapStyleKey,
} from "@/lib/mobility/map-settings";

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
  source?: {
    label: string;
    connectorId: string;
    host: string | null;
    urls: {
      list: string | null;
      device: string | null;
      status: string | null;
    };
  };
}

const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  });

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
  defaultCentre,
  defaultZoom,
}: {
  projectId: string;
  mapboxToken: string | null;
  sourcesHref: string;
  defaultCentre: { lat: number; lng: number };
  defaultZoom: number;
}) {
  const { data, mutate } = useSWR<DevicesResponse>(
    `/api/projects/${projectId}/devices`,
    fetcher,
    { refreshInterval: 30_000 },
  );
  const devices = useMemo(() => data?.devices ?? [], [data]);

  // Optional `?device=<id>` deeplink — set the selection on first
  // arrival from the Devices table, the Alerts feed, or a shared URL.
  const searchParams = useSearchParams();
  const focusId = searchParams?.get("device") ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(focusId);
  useEffect(() => {
    if (focusId && focusId !== selectedId) {
      setSelectedId(focusId);
    }
    // We don't include `selectedId` in deps — this effect should only
    // fire when the deeplink changes, never when the user navigates
    // around within the console.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId]);
  const selected = useMemo(
    () => devices.find((d) => d.id === selectedId) ?? null,
    [devices, selectedId],
  );

  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const layersReadyRef = useRef(false);
  /** Re-attachable layer setup — populated inside the init useEffect
   *  and re-invoked from the style-swap effect after `setStyle` wipes
   *  the previous style's user layers. */
  const setupLayersRef = useRef<(() => void) | null>(null);
  /** Latest style key the map is showing — keyed off settings so we
   *  only fire `setStyle` when the operator actually picks a new
   *  style, not on every light / terrain toggle. */
  const activeStyleRef = useRef<MapStyleKey>("standard");

  /** Console settings — lazy-init from localStorage so the first paint
   *  uses the operator's last picks, then mirrors back to storage on
   *  every change. SSR returns defaults; client picks up the saved
   *  state on mount via useState's initialiser. */
  const [settings, setSettings] = useState<ConsoleSettings>(
    DEFAULT_CONSOLE_SETTINGS,
  );
  // Hydrate from localStorage after mount (SSR safety).
  useEffect(() => {
    setSettings(
      loadMapEnvSettings(settingsStorageKey(projectId), DEFAULT_CONSOLE_SETTINGS),
    );
  }, [projectId]);
  useEffect(() => {
    saveMapEnvSettings(settingsStorageKey(projectId), settings);
  }, [settings, projectId]);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (!mapboxToken || !mapEl.current || mapRef.current) return;
    mapboxgl.accessToken = mapboxToken;
    // Initial style is read from the latest saved settings — Standard
    // by default, but the operator may have switched to Satellite or
    // Minimal on a prior session. Subsequent toggles flip via
    // `setStyle` in the style-swap effect below.
    const map = new mapboxgl.Map({
      container: mapEl.current,
      style: MAP_STYLES[latestSettingsRef.current.mapStyle].url,
      center: [defaultCentre.lng, defaultCentre.lat],
      zoom: defaultZoom,
      pitch: 30,
      maxPitch: 85,
      attributionControl: false,
    });
    map.addControl(
      new mapboxgl.AttributionControl({ compact: true }),
      "bottom-right",
    );
    // showCompass keeps the pitch/bearing reset button — useful now
    // that the operator can tilt + rotate to look at terrain + 3D
    // buildings.
    map.addControl(
      new mapboxgl.NavigationControl({ visualizePitch: true }),
      "bottom-right",
    );
    mapRef.current = map;

    /** Re-attachable source + layer + handler bundle. Idempotent at
     *  the source level so calling it twice (init + post-`setStyle`)
     *  is safe; the handler attachments are re-bound on each call
     *  because `setStyle` clears the layer-id event registry.
     *
     *  GPU-rendered circles instead of HTML markers — fixes the
     *  "1000+ DOM nodes is slow" + "markers drift on projection
     *  change" pair. Native clustering means visitors see thousands of
     *  devices summarised at low zoom and the individual rows when
     *  they zoom in. */
    const setupLayers = () => {
      if (map.getSource(SOURCE_ID)) return;
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      });
      map.addLayer({
        id: CLUSTER_LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "step",
            ["get", "point_count"],
            "rgba(96, 165, 250, 0.7)",
            10,
            "rgba(52, 211, 153, 0.75)",
            50,
            "rgba(250, 204, 21, 0.8)",
          ],
          "circle-radius": [
            "step",
            ["get", "point_count"],
            18,
            10,
            24,
            50,
            32,
          ],
          "circle-stroke-width": 2,
          "circle-stroke-color": "rgba(15, 23, 42, 0.7)",
        },
      });
      map.addLayer({
        id: CLUSTER_COUNT_LAYER_ID,
        type: "symbol",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
          "text-size": 12,
        },
        paint: { "text-color": "#ffffff" },
      });
      map.addLayer({
        id: POINT_LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": curationColourExpr(),
          "circle-radius": 6,
          "circle-stroke-width": 2,
          "circle-stroke-color": "rgba(15, 23, 42, 0.7)",
        },
      });
      // Selected highlight: same source, filtered to one id, painted
      // larger with a white halo for emphasis.
      map.addLayer({
        id: SELECTED_LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        filter: ["==", ["get", "id"], NO_SELECTION_SENTINEL],
        paint: {
          "circle-color": curationColourExpr(),
          "circle-radius": 11,
          "circle-stroke-width": 3,
          "circle-stroke-color": "#ffffff",
        },
      });

      // Cluster click → zoom to its expansion zoom.
      map.on("click", CLUSTER_LAYER_ID, (e) => {
        const features = map.queryRenderedFeatures(e.point, {
          layers: [CLUSTER_LAYER_ID],
        });
        const first = features[0];
        if (!first?.properties) return;
        const clusterId = first.properties.cluster_id as number;
        const source = map.getSource(SOURCE_ID) as GeoJSONSource;
        source.getClusterExpansionZoom(
          clusterId,
          (err: Error | null | undefined, zoom?: number | null) => {
            if (err || zoom == null) return;
            const geom = first.geometry as GeoJSON.Geometry;
            if (geom.type !== "Point") return;
            const coords = geom.coordinates as [number, number];
            map.easeTo({ center: coords, zoom });
          },
        );
      });

      // Unclustered point click → select.
      map.on("click", POINT_LAYER_ID, (e: MapMouseEvent & { features?: unknown[] }) => {
        const f = e.features?.[0] as
          | { properties?: { id?: string } }
          | undefined;
        const id = f?.properties?.id;
        if (typeof id === "string") setSelectedId(id);
      });

      // Cursor affordances on hover.
      for (const layer of [CLUSTER_LAYER_ID, POINT_LAYER_ID, SELECTED_LAYER_ID]) {
        map.on("mouseenter", layer, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", layer, () => {
          map.getCanvas().style.cursor = "";
        });
      }

      layersReadyRef.current = true;
      // Push initial data in case devices loaded before layers did.
      const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      source?.setData(toGeoJSON(latestDevicesRef.current));
    };
    setupLayersRef.current = setupLayers;

    /** Initial style ready hook — apply env settings, then bring up
     *  the device layers. Subsequent style swaps go through the
     *  effect below. */
    const onLoad = () => {
      applyConsoleSettings(map, latestSettingsRef.current);
      setupLayers();
    };

    if (map.isStyleLoaded()) {
      onLoad();
    } else {
      map.once("load", onLoad);
    }
    activeStyleRef.current = latestSettingsRef.current.mapStyle;

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(mapEl.current);
    return () => ro.disconnect();
    // We intentionally don't react to defaultCentre/defaultZoom changes
    // post-mount — the map is for steering, not constant recentering;
    // an Identity save takes effect on next page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapboxToken]);

  // Keep latest devices accessible from the init effect's late onLoad.
  const latestDevicesRef = useRef<DeviceRow[]>(devices);
  latestDevicesRef.current = devices;

  // Same trick for settings — onLoad fires asynchronously after the
  // settings effect first runs, so it needs the latest value not the
  // initial closure.
  const latestSettingsRef = useRef<ConsoleSettings>(settings);
  latestSettingsRef.current = settings;

  // Re-apply settings to the map whenever the operator changes them.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!map.isStyleLoaded()) {
      map.once("idle", () => applyConsoleSettings(map, settings));
      return;
    }
    applyConsoleSettings(map, settings);
  }, [settings]);

  /** Style swap — heavier than a config-property update; `setStyle`
   *  wipes user layers, so we re-attach via `setupLayersRef`. Gated
   *  on the diff to avoid re-running on every light / terrain toggle. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (activeStyleRef.current === settings.mapStyle) return;
    activeStyleRef.current = settings.mapStyle;
    layersReadyRef.current = false;
    map.setStyle(MAP_STYLES[settings.mapStyle].url);
    map.once("style.load", () => {
      applyConsoleSettings(map, latestSettingsRef.current);
      setupLayersRef.current?.();
    });
  }, [settings.mapStyle]);

  // Push device updates into the GeoJSON source.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layersReadyRef.current) return;
    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    if (!source) return;
    source.setData(toGeoJSON(devices));
  }, [devices]);

  // Move the selected-highlight filter when selection changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layersReadyRef.current) return;
    if (!map.getLayer(SELECTED_LAYER_ID)) return;
    map.setFilter(SELECTED_LAYER_ID, [
      "==",
      ["get", "id"],
      selectedId ?? NO_SELECTION_SENTINEL,
    ]);
  }, [selectedId]);

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
        <div className="pointer-events-auto absolute right-4 top-4 flex flex-col items-end gap-2">
          <SourcesChip href={sourcesHref} />
          <ConsoleSettingsChip
            settings={settings}
            onChange={setSettings}
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
          />
        </div>
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

/* ─── GeoJSON helpers ──────────────────────────────────────────────── */

const SOURCE_ID = "devices";
const CLUSTER_LAYER_ID = "devices-clusters";
const CLUSTER_COUNT_LAYER_ID = "devices-cluster-count";
const POINT_LAYER_ID = "devices-points";
const SELECTED_LAYER_ID = "devices-selected";
const NO_SELECTION_SENTINEL = "__none__";

/* ─── Console settings (per-project, localStorage) ─────────────────── */

/** Reuse the shared map env shape so the public viewer and the
 *  operator console stay in lockstep when new style options ship. */
type ConsoleSettings = MapEnvSettings;

const DEFAULT_CONSOLE_SETTINGS: ConsoleSettings = {
  mapStyle: "standard",
  lightPreset: "night",
  showTerrain: true,
  show3dBuildings: true,
};

function settingsStorageKey(projectId: string): string {
  return `klorad-mobility-console-settings:${projectId}`;
}

/** Convert devices to a GeoJSON FeatureCollection. Properties carry
 *  the booleans the colour expression switches on plus the id the
 *  click handler reads. */
function toGeoJSON(
  devices: DeviceRow[],
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: devices
      .filter((d) => d.lat != null && d.lng != null)
      .map((d) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [d.lng as number, d.lat as number],
        },
        properties: {
          id: d.id,
          name: d.customLabel ?? d.name,
          subsystem: d.subsystem,
          included: d.included,
          isPublic: d.isPublic,
          needsReview: d.needsReview,
        },
      })),
  };
}

/** Mapbox case expression: yellow → green → blue → slate based on
 *  the same precedence the legend documents. */
function curationColourExpr(): mapboxgl.ExpressionSpecification {
  return [
    "case",
    ["get", "needsReview"],
    "#facc15",
    ["get", "isPublic"],
    "#34d399",
    ["get", "included"],
    "#60a5fa",
    "#94a3b8",
  ];
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
      className="inline-flex items-center gap-1.5 rounded-full border border-line-soft bg-bg/95 px-3.5 py-2 text-xs font-medium text-text-primary shadow-sm backdrop-blur transition-colors hover:border-accent hover:text-accent"
    >
      <Database size={12} strokeWidth={1.8} aria-hidden />
      Data sources
      <ArrowUpRight size={11} strokeWidth={1.8} aria-hidden />
    </Link>
  );
}

/* ─── Console settings chip + popover ──────────────────────────────── */

function ConsoleSettingsChip({
  settings,
  onChange,
  open,
  onOpenChange,
}: {
  settings: ConsoleSettings;
  onChange: (s: ConsoleSettings) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 rounded-full border bg-bg/95 px-3.5 py-2 text-xs font-medium shadow-sm backdrop-blur transition-colors ${
          open
            ? "border-accent text-accent"
            : "border-line-soft text-text-primary hover:border-accent hover:text-accent"
        }`}
      >
        <Settings size={12} strokeWidth={1.8} aria-hidden />
        Console
      </button>
      {open ? (
        <div className="mt-2 w-[280px] rounded-2xl border border-line-soft bg-bg/95 p-4 text-xs shadow-md backdrop-blur">
          {/* Map style */}
          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.22em] text-text-tertiary">
            <Layers size={11} strokeWidth={1.8} aria-hidden />
            Style
          </p>
          <div className="grid grid-cols-3 gap-1">
            {MAP_STYLE_LIST.map(({ key, def }) => {
              const active = settings.mapStyle === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange({ ...settings, mapStyle: key })}
                  className={`rounded-md px-1.5 py-2 text-[10px] font-medium transition-colors ${
                    active
                      ? "bg-accent text-accent-contrast"
                      : "text-text-secondary hover:bg-surface-2 hover:text-text-primary"
                  }`}
                >
                  <span className="block">{def.label}</span>
                  <span
                    className={`mt-0.5 block text-[9px] font-normal ${
                      active ? "opacity-80" : "text-text-tertiary"
                    }`}
                  >
                    {def.description}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Light preset */}
          <p className="mt-4 mb-1.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.22em] text-text-tertiary">
            <Sun size={11} strokeWidth={1.8} aria-hidden />
            Light
            {!MAP_STYLES[settings.mapStyle].supportsLightPreset ? (
              <span className="ml-1 text-[8px] font-normal normal-case tracking-normal text-text-tertiary">
                (Standard / Satellite only)
              </span>
            ) : null}
          </p>
          <div className="grid grid-cols-4 gap-1">
            {(
              [
                { value: "day", label: "Day", Icon: Sun },
                { value: "dawn", label: "Dawn", Icon: Sunrise },
                { value: "dusk", label: "Dusk", Icon: Sunset },
                { value: "night", label: "Night", Icon: Moon },
              ] as const
            ).map(({ value, label, Icon }) => {
              const active = settings.lightPreset === value;
              const disabled = !MAP_STYLES[settings.mapStyle].supportsLightPreset;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  disabled={disabled}
                  onClick={() =>
                    onChange({ ...settings, lightPreset: value })
                  }
                  className={`flex flex-col items-center justify-center gap-0.5 rounded-md px-1.5 py-2 text-[10px] font-medium transition-colors enabled:hover:bg-surface-2 enabled:hover:text-text-primary disabled:opacity-40 ${
                    active && !disabled
                      ? "bg-accent text-accent-contrast"
                      : "text-text-secondary"
                  }`}
                >
                  <Icon size={14} strokeWidth={1.8} aria-hidden />
                  {label}
                </button>
              );
            })}
          </div>

          {/* Toggles */}
          <div className="mt-4 space-y-2">
            <SettingsToggleRow
              icon={Mountain}
              label="Terrain"
              checked={settings.showTerrain}
              onChange={(showTerrain) =>
                onChange({ ...settings, showTerrain })
              }
            />
            <SettingsToggleRow
              icon={Box}
              label="3D buildings"
              checked={settings.show3dBuildings}
              onChange={(show3dBuildings) =>
                onChange({ ...settings, show3dBuildings })
              }
              disabled={!MAP_STYLES[settings.mapStyle].supports3dObjects}
              disabledHint="Standard / Satellite only"
            />
          </div>

          {/* Reset */}
          <button
            type="button"
            onClick={() => onChange(DEFAULT_CONSOLE_SETTINGS)}
            className="mt-4 w-full rounded-md border border-line-soft px-3 py-1.5 text-[11px] font-medium text-text-tertiary transition-colors hover:border-line-strong hover:text-text-primary"
          >
            Reset to defaults
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SettingsToggleRow({
  icon: Icon,
  label,
  checked,
  onChange,
  disabled,
  disabledHint,
}: {
  icon: LucideIcon;
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  disabledHint?: string;
}) {
  return (
    <label
      className={`flex items-center justify-between rounded-md px-2 py-1.5 transition-colors ${
        disabled ? "opacity-40" : "cursor-pointer hover:bg-surface-2"
      }`}
    >
      <span className="inline-flex items-center gap-2 text-text-primary">
        <Icon size={12} strokeWidth={1.8} aria-hidden />
        {label}
        {disabled && disabledHint ? (
          <span className="text-[9px] text-text-tertiary">({disabledHint})</span>
        ) : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-accent" : "border border-line-strong bg-bg"
        }`}
      >
        <span
          aria-hidden
          className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}

/* ─── Map settings application ─────────────────────────────────────── */

/** Project the current `ConsoleSettings` onto the Mapbox style.
 *  Delegates to the shared `applyMapEnvSettings` so the operator
 *  console and the public world viewer stay in lockstep when style
 *  options grow. */
function applyConsoleSettings(
  map: MapboxMap,
  settings: ConsoleSettings,
): void {
  applyMapEnvSettings(map, settings);
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
      | { kind: "cctv-snapshot"; url: string }
      | { kind: "dms-image-list"; path: string }
      | null;
    [key: string]: unknown;
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

      {/* ── Source URLs (debug) ─────────────────────────────────────── */}
      {live?.source ? <SourceSection source={live.source} /> : null}

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

            {/* CCTV snapshot — refresh every 5 s with a cache-busting
                query so the still updates without a manual reload. */}
            {device.subsystem === "cctv" &&
              payload.media?.kind === "cctv-snapshot" && (
                <CctvSnapshot url={payload.media.url} alt={device.name} />
              )}

            {/* CCTV without any media URL — say so explicitly instead
                of leaving a blank panel below the status. */}
            {device.subsystem === "cctv" && !payload.media && (
              <div className="rounded-xl border border-line-soft bg-surface-2 p-5 text-center text-xs text-text-tertiary">
                No live stream or snapshot URL is configured for this
                camera on the source.
              </div>
            )}
          </div>
        )}

        {/* DMS sign details — surface the rich status data the
            renderer doesn't show otherwise. */}
        {device.subsystem === "dms" && live?.status && (
          <DmsSignDetails
            status={live.status.raw as Record<string, unknown>}
            payload={payload as Record<string, unknown>}
          />
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

/* ─── CCTV snapshot with auto-refresh ──────────────────────────────── */

function CctvSnapshot({ url, alt }: { url: string; alt: string }) {
  // Cache-bust on a 5 s tick. Initial render uses 0 so SSR + first
  // client paint stay deterministic (no hydration mismatch); the real
  // ticking starts after mount.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    setTick(Date.now());
    const id = window.setInterval(() => setTick(Date.now()), 5_000);
    return () => window.clearInterval(id);
  }, []);
  const src =
    tick === 0
      ? url
      : `${url}${url.includes("?") ? "&" : "?"}t=${tick}`;
  return (
    <div className="overflow-hidden rounded-xl border border-line-soft bg-black">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="aspect-video w-full object-cover"
      />
      <p className="px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
        Snapshot · refreshing every 5 s
      </p>
    </div>
  );
}

/* ─── DMS sign details panel ───────────────────────────────────────── */

function DmsSignDetails({
  status,
  payload,
}: {
  status: Record<string, unknown>;
  payload: Record<string, unknown>;
}) {
  const num = (v: unknown): number | null =>
    typeof v === "number" ? v : null;
  const str = (v: unknown): string | null =>
    typeof v === "string" && v.length > 0 ? v : null;

  // Pull from both status (current state) and payload (device
  // capabilities) so the panel is one coherent block.
  const brightness = status.brightnessLevel as
    | { min?: number; max?: number; current?: number }
    | undefined;
  const photocell = status.photocellLevel as
    | { min?: number; max?: number; current?: number }
    | undefined;
  const lightOutput = status.lightOutput as
    | { min?: number; max?: number; current?: number }
    | undefined;

  const shortStatus = num(status.shortStatus);
  const controlMode = str(status.controlMode);
  const manualLevel = num(status.manualLevel);
  const beacon = typeof status.beacon === "boolean" ? status.beacon : null;
  const graphic = typeof status.graphic === "boolean" ? status.graphic : null;
  const brightnessError = str(status.brightnessError);
  const signId = num(status.signId);

  const signType = num(payload.signType);
  const beaconType = num(payload.beaconType);
  const pixelHeight = num(payload.pixelHeight);
  const pixelWidth = num(payload.pixelWidth);
  const maxPages = num(payload.maxPages);
  const maxLinesPerPage = num(payload.maxLinesPerPage);
  const maxCharsPerLine = num(payload.maxCharsPerLine);

  return (
    <div className="mt-3 rounded-xl border border-line-soft bg-surface-2 p-4">
      <SectionEyebrow icon={Signpost}>Sign details</SectionEyebrow>

      {/* Capabilities */}
      <div className="mt-3">
        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.22em] text-text-tertiary">
          Capabilities
        </p>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
          {signType != null && <KV label="Sign type">{signType}</KV>}
          {beaconType != null && <KV label="Beacon type">{beaconType}</KV>}
          {pixelWidth != null && pixelHeight != null && (
            <KV label="Pixels">
              {pixelWidth} × {pixelHeight}
            </KV>
          )}
          {(maxPages != null ||
            maxLinesPerPage != null ||
            maxCharsPerLine != null) && (
            <KV label="Grid">
              {maxPages ?? "?"} pg · {maxLinesPerPage ?? "?"} ln ·{" "}
              {maxCharsPerLine ?? "?"} ch
            </KV>
          )}
          {signId != null && <KV label="Sign ID">{signId}</KV>}
        </dl>
      </div>

      {/* Current state */}
      <div className="mt-4">
        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.22em] text-text-tertiary">
          State
        </p>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
          {controlMode && <KV label="Mode">{controlMode}</KV>}
          {brightness?.current != null && brightness.max != null && (
            <KV label="Brightness">
              {brightness.current} / {brightness.max}
            </KV>
          )}
          {photocell?.current != null && photocell.max != null && (
            <KV label="Photocell">
              {photocell.current} / {photocell.max}
            </KV>
          )}
          {lightOutput?.current != null && lightOutput.max != null && (
            <KV label="Light output">
              {lightOutput.current.toLocaleString()} /{" "}
              {lightOutput.max.toLocaleString()}
            </KV>
          )}
          {manualLevel != null && <KV label="Manual level">{manualLevel}</KV>}
          {beacon != null && <KV label="Beacon">{beacon ? "On" : "Off"}</KV>}
          {graphic != null && (
            <KV label="Graphic">{graphic ? "On" : "Off"}</KV>
          )}
        </dl>
      </div>

      {/* Health */}
      <div className="mt-4">
        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.22em] text-text-tertiary">
          Health
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {shortStatus != null && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] ${
                shortStatus === 0
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-red-500/10 text-red-600"
              }`}
            >
              {shortStatus === 0
                ? "shortStatus 0 (OK)"
                : `shortStatus 0x${shortStatus.toString(16).toUpperCase()}`}
            </span>
          )}
          {brightnessError && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-red-600">
              {brightnessError}
            </span>
          )}
          {brightnessError == null && shortStatus === 0 && (
            <span className="text-[11px] text-text-tertiary">
              No fault flags raised.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function KV({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <dt className="text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
        {label}
      </dt>
      <dd className="text-text-primary">{children}</dd>
    </>
  );
}

/* ─── Small primitives reused across the drawer ────────────────────── */

function SourceSection({
  source,
}: {
  source: NonNullable<LiveResponse["source"]>;
}) {
  return (
    <section className="border-b border-line-soft bg-surface-2 p-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <SectionEyebrow icon={Database}>Source</SectionEyebrow>
        <span className="rounded-full bg-bg px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-text-tertiary">
          {source.connectorId}
        </span>
      </div>
      <p className="mb-3 truncate text-xs text-text-primary">
        {source.label}
      </p>
      <div className="space-y-2">
        <UrlRow label="Device" url={source.urls.device} />
        <UrlRow label="Status" url={source.urls.status} />
        <UrlRow label="List" url={source.urls.list} />
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-text-tertiary">
        Endpoints the connector hits. Hit them with the same basic-auth
        creds to verify the data matches.
      </p>
    </section>
  );
}

function UrlRow({ label, url }: { label: string; url: string | null }) {
  if (!url) {
    return (
      <div className="grid grid-cols-[60px_1fr] items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
          {label}
        </span>
        <span className="text-[11px] italic text-text-tertiary">
          (none for this device)
        </span>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-[60px_1fr_auto_auto] items-center gap-2">
      <span className="text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
        {label}
      </span>
      <code
        className="overflow-hidden truncate rounded-md bg-bg px-2 py-1 font-mono text-[10px] text-text-secondary"
        title={url}
      >
        {url}
      </code>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(url);
          toast.success("Copied");
        }}
        aria-label={`Copy ${label} URL`}
        className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-bg hover:text-text-primary"
      >
        <Copy size={11} strokeWidth={1.8} />
      </button>
      <a
        href={url}
        target="_blank"
        rel="noopener"
        aria-label={`Open ${label} URL`}
        className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary transition-colors hover:bg-bg hover:text-text-primary"
      >
        <ExternalLink size={11} strokeWidth={1.8} />
      </a>
    </div>
  );
}

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
