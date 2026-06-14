"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import mapboxgl, {
  type GeoJSONSource,
  type Map as MapboxMap,
  type MapMouseEvent,
} from "mapbox-gl";
import {
  ArrowLeft,
  Box,
  Camera,
  Layers as LayersIcon,
  MapPin,
  Moon,
  Mountain,
  Radio,
  Settings,
  Signpost,
  Sun,
  Sunrise,
  Sunset,
} from "lucide-react";
import type { PublicWorldDevice } from "@/lib/mobility/world-resolver";
import {
  applyMapEnvSettings,
  loadMapEnvSettings,
  saveMapEnvSettings,
  MAP_STYLES,
  MAP_STYLE_LIST,
  type MapEnvSettings,
  type MapStyleKey,
} from "@/lib/mobility/map-settings";
import { PushOptIn } from "./PushOptIn";

interface Props {
  slug: string;
  name: string;
  description: string | null;
  devices: PublicWorldDevice[];
  theme: Record<string, unknown>;
  mapboxToken: string | null;
}

const DEFAULT_PRIMARY = "#0ea5e9";
const DEFAULT_BG = "#0b1220";

const SOURCE_ID = "world-devices";
const CLUSTER_LAYER = "world-clusters";
const CLUSTER_COUNT_LAYER = "world-cluster-count";
const POINT_LAYER = "world-points";
const SELECTED_LAYER = "world-points-selected";
const NO_SELECTION = "__none__";

const DEFAULT_SETTINGS: MapEnvSettings = {
  mapStyle: "standard",
  lightPreset: "day",
  showTerrain: false,
  show3dBuildings: true,
};

function settingsStorageKey(slug: string): string {
  return `klorad-mobility-world-settings:${slug}`;
}

function pickHex(value: unknown, fallback: string): string {
  if (typeof value === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) {
    return value;
  }
  return fallback;
}

function fitToDevices(map: MapboxMap, devices: PublicWorldDevice[]): void {
  const located = devices.filter(
    (d): d is PublicWorldDevice & { lat: number; lng: number } =>
      d.lat != null && d.lng != null,
  );
  if (located.length === 0) return;
  if (located.length === 1) {
    map.flyTo({ center: [located[0].lng, located[0].lat], zoom: 13 });
    return;
  }
  const bounds = new mapboxgl.LngLatBounds();
  located.forEach((d) => bounds.extend([d.lng, d.lat]));
  map.fitBounds(bounds, { padding: 64, maxZoom: 13, duration: 0 });
}

/**
 * Set up the device source + four layers + click + hover handlers.
 * Idempotent — bail out if the source is already present (e.g. an
 * extra `style.load` after a no-op style swap). Re-invoked after
 * `map.setStyle` because changing the style wipes all custom layers.
 */
function setupDeviceLayers(
  map: MapboxMap,
  primary: string,
  selectedId: string | null,
  data: GeoJSON.FeatureCollection<GeoJSON.Point>,
  onClusterClick: (clusterId: number, coords: [number, number]) => void,
  onPointClick: (id: string) => void,
  onBackgroundClick: () => void,
): void {
  if (map.getSource(SOURCE_ID)) return;

  map.addSource(SOURCE_ID, {
    type: "geojson",
    data,
    cluster: true,
    clusterMaxZoom: 14,
    clusterRadius: 50,
  });
  map.addLayer({
    id: CLUSTER_LAYER,
    type: "circle",
    source: SOURCE_ID,
    filter: ["has", "point_count"],
    paint: {
      "circle-color": primary,
      "circle-opacity": 0.6,
      "circle-stroke-color": primary,
      "circle-stroke-opacity": 0.9,
      "circle-stroke-width": 2,
      "circle-radius": ["step", ["get", "point_count"], 16, 25, 22, 100, 28],
    },
  });
  map.addLayer({
    id: CLUSTER_COUNT_LAYER,
    type: "symbol",
    source: SOURCE_ID,
    filter: ["has", "point_count"],
    layout: {
      "text-field": ["get", "point_count_abbreviated"],
      "text-size": 12,
      "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
    },
    paint: { "text-color": "#ffffff" },
  });
  map.addLayer({
    id: POINT_LAYER,
    type: "circle",
    source: SOURCE_ID,
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-radius": 6,
      "circle-color": primary,
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 2,
    },
  });
  map.addLayer({
    id: SELECTED_LAYER,
    type: "circle",
    source: SOURCE_ID,
    filter: ["==", ["get", "id"], selectedId ?? NO_SELECTION],
    paint: {
      "circle-radius": 10,
      "circle-color": "#ffffff",
      "circle-stroke-color": primary,
      "circle-stroke-width": 3,
    },
  });

  map.on("click", CLUSTER_LAYER, (e: MapMouseEvent) => {
    const feature = (e.features ?? [])[0];
    if (!feature) return;
    const clusterId = feature.properties?.cluster_id as number | undefined;
    if (clusterId == null) return;
    const coords = (feature.geometry as unknown as {
      coordinates: [number, number];
    }).coordinates;
    onClusterClick(clusterId, coords);
  });
  map.on("click", POINT_LAYER, (e: MapMouseEvent) => {
    const feature = (e.features ?? [])[0];
    const id = feature?.properties?.id as string | undefined;
    if (id) onPointClick(id);
  });
  map.on("click", (e: MapMouseEvent) => {
    const hits = map.queryRenderedFeatures(e.point, {
      layers: [POINT_LAYER, CLUSTER_LAYER],
    });
    if (hits.length === 0) onBackgroundClick();
  });
  for (const layer of [POINT_LAYER, CLUSTER_LAYER]) {
    map.on(
      "mouseenter",
      layer,
      () => (map.getCanvas().style.cursor = "pointer"),
    );
    map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
  }
}

export function WorldViewer({
  slug,
  name,
  description,
  devices,
  theme,
  mapboxToken,
}: Props) {
  const primary = pickHex(theme.primaryColor, DEFAULT_PRIMARY);
  const bg = pickHex(theme.backgroundColor, DEFAULT_BG);
  const logoUrl = typeof theme.logoUrl === "string" ? theme.logoUrl : null;
  const tagline = typeof theme.tagline === "string" ? theme.tagline : null;

  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const layersReadyRef = useRef(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => devices.find((d) => d.id === selectedId) ?? null,
    [devices, selectedId],
  );

  /** Map env settings — lazy-init defaults, hydrated from localStorage
   *  on mount so SSR + first paint stay consistent (no hydration
   *  drift). */
  const [settings, setSettings] = useState<MapEnvSettings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => {
    setSettings(loadMapEnvSettings(settingsStorageKey(slug), DEFAULT_SETTINGS));
  }, [slug]);
  useEffect(() => {
    saveMapEnvSettings(settingsStorageKey(slug), settings);
  }, [slug, settings]);

  const featureCollection = useMemo<
    GeoJSON.FeatureCollection<GeoJSON.Point>
  >(() => {
    return {
      type: "FeatureCollection",
      features: devices
        .filter(
          (d): d is PublicWorldDevice & { lat: number; lng: number } =>
            d.lat != null && d.lng != null,
        )
        .map((d) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [d.lng, d.lat] },
          properties: {
            id: d.id,
            name: d.name,
            subsystem: d.subsystem,
            primaryRoad: d.primaryRoad,
            crossRoad: d.crossRoad,
          },
        })),
    };
  }, [devices]);

  // Refs the layer-setup callbacks close over so re-setup after a
  // style swap reaches the latest data / selection / handlers.
  const latestDataRef = useRef(featureCollection);
  latestDataRef.current = featureCollection;
  const latestSelectedRef = useRef(selectedId);
  latestSelectedRef.current = selectedId;
  const latestSettingsRef = useRef(settings);
  latestSettingsRef.current = settings;

  const attachLayers = useCallback(
    (map: MapboxMap) => {
      setupDeviceLayers(
        map,
        primary,
        latestSelectedRef.current,
        latestDataRef.current,
        (clusterId, coords) => {
          const source = map.getSource(SOURCE_ID) as GeoJSONSource;
          source.getClusterExpansionZoom(clusterId, (err, zoom) => {
            if (err) return;
            map.easeTo({
              center: coords,
              zoom: zoom ?? map.getZoom() + 1,
            });
          });
        },
        (id) => setSelectedId(id),
        () => setSelectedId(null),
      );
      layersReadyRef.current = true;
    },
    [primary],
  );

  // Init map once.
  useEffect(() => {
    if (!mapboxToken || !mapEl.current || mapRef.current) return;
    mapboxgl.accessToken = mapboxToken;
    const initialStyle = MAP_STYLES[latestSettingsRef.current.mapStyle].url;
    const map = new mapboxgl.Map({
      container: mapEl.current,
      style: initialStyle,
      center: [22.9444, 40.6401],
      zoom: 11,
      pitch: 30,
      maxPitch: 85,
      attributionControl: false,
    });
    mapRef.current = map;

    map.on("load", () => {
      applyMapEnvSettings(map, latestSettingsRef.current);
      attachLayers(map);
      fitToDevices(map, devices);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      layersReadyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init-once
  }, [mapboxToken]);

  // Style swap — `setStyle` wipes user layers, so we re-attach on
  // `style.load`. Tracked separately from the env-settings effect so a
  // light toggle doesn't trigger a costly style reload.
  const lastStyleRef = useRef<MapStyleKey>(DEFAULT_SETTINGS.mapStyle);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (lastStyleRef.current === settings.mapStyle) return;
    lastStyleRef.current = settings.mapStyle;
    layersReadyRef.current = false;
    map.setStyle(MAP_STYLES[settings.mapStyle].url);
    map.once("style.load", () => {
      applyMapEnvSettings(map, latestSettingsRef.current);
      attachLayers(map);
    });
  }, [settings.mapStyle, attachLayers]);

  // Light + terrain + 3D — cheap config updates, no reload.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!map.isStyleLoaded()) {
      map.once("idle", () => applyMapEnvSettings(map, settings));
      return;
    }
    applyMapEnvSettings(map, settings);
  }, [settings]);

  // Sync data + selection filter on changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layersReadyRef.current) return;
    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    source?.setData(featureCollection);
  }, [featureCollection]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layersReadyRef.current) return;
    map.setFilter(SELECTED_LAYER, [
      "==",
      ["get", "id"],
      selectedId ?? NO_SELECTION,
    ]);
  }, [selectedId]);

  if (!mapboxToken) {
    return (
      <main
        className="flex w-full items-center justify-center p-8 text-center text-sm text-white"
        style={{ height: "100dvh", backgroundColor: bg }}
      >
        Map is unavailable.
      </main>
    );
  }

  return (
    <main
      className="relative w-full overflow-hidden"
      // Inline `height` so the layout doesn't depend on Tailwind's
      // arbitrary-value JIT picking up `h-[100dvh]` for this route.
      // Mapbox needs a measurable container before init, and any
      // height-purge causes the canvas to collapse to 0 — symptom is
      // a blank screen with the html/body background showing through.
      style={{ height: "100dvh", backgroundColor: bg }}
    >
      <div
        ref={mapEl}
        className="absolute inset-0"
        style={{ width: "100%", height: "100%" }}
      />

      {/* World title — top-left card. Kept compact so it doesn't
          dominate the map; the install prompt + drawer live elsewhere. */}
      <header
        className="pointer-events-none absolute left-4 top-4 max-w-[min(86%,360px)] rounded-2xl border border-white/10 bg-[var(--world-bg)]/85 px-4 py-3 text-white shadow-lg backdrop-blur"
        style={{ ["--world-bg" as string]: bg }}
      >
        <div className="flex items-center gap-2">
          {logoUrl ? (
            // Operator-provided URL on an arbitrary host — next/image's
            // remote-pattern allowlist is the wrong shape for that
            // tenancy model, so plain <img> is intentional.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className="h-7 w-7 shrink-0 rounded-md object-cover"
            />
          ) : null}
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/60">
            Klorad Mobility
          </p>
        </div>
        <h1 className="mt-1 text-base font-semibold">{name}</h1>
        {tagline || description ? (
          <p className="mt-1 line-clamp-2 text-xs text-white/70">
            {tagline || description}
          </p>
        ) : null}
        <p className="mt-1.5 text-[11px] text-white/50">
          <span style={{ color: primary }}>{devices.length}</span> devices ·{" "}
          <code className="font-mono">/w/{slug}</code>
        </p>
        <div className="pointer-events-auto mt-3">
          <PushOptIn slug={slug} primary={primary} />
        </div>
      </header>

      <MapSettingsButton
        primary={primary}
        settings={settings}
        onChange={setSettings}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />

      <DeviceDrawer
        device={selected}
        primary={primary}
        bg={bg}
        onClose={() => setSelectedId(null)}
      />
    </main>
  );
}

/* ───────────────────── Map settings panel ─────────────────────── */

function MapSettingsButton({
  primary,
  settings,
  onChange,
  open,
  onOpenChange,
}: {
  primary: string;
  settings: MapEnvSettings;
  onChange: (next: MapEnvSettings) => void;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const styleDef = MAP_STYLES[settings.mapStyle];
  return (
    <div className="absolute bottom-4 right-4 z-20 flex flex-col items-end gap-2">
      {open ? (
        <MapSettingsPanel
          primary={primary}
          settings={settings}
          onChange={onChange}
        />
      ) : null}
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-label="Map settings"
        className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white shadow-lg backdrop-blur transition-colors hover:bg-black/75"
        style={open ? { borderColor: primary, color: primary } : undefined}
        title={`Style: ${styleDef.label}`}
      >
        <Settings size={16} strokeWidth={1.8} aria-hidden />
      </button>
    </div>
  );
}

function MapSettingsPanel({
  primary,
  settings,
  onChange,
}: {
  primary: string;
  settings: MapEnvSettings;
  onChange: (next: MapEnvSettings) => void;
}) {
  const activeStyle = MAP_STYLES[settings.mapStyle];
  return (
    <div className="pointer-events-auto w-[280px] rounded-2xl border border-white/15 bg-[#0b1220]/95 p-4 text-xs text-white shadow-2xl backdrop-blur">
      {/* Style */}
      <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.22em] text-white/60">
        <LayersIcon size={11} strokeWidth={1.8} aria-hidden />
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
              className="rounded-md px-1.5 py-2 text-[10px] font-medium text-white/80 transition-colors hover:bg-white/10"
              style={
                active
                  ? { backgroundColor: primary, color: "#0b1220" }
                  : undefined
              }
            >
              <span className="block">{def.label}</span>
              <span className="mt-0.5 block text-[9px] font-normal opacity-70">
                {def.description}
              </span>
            </button>
          );
        })}
      </div>

      {/* Light */}
      <p
        className={`mt-4 mb-1.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.22em] ${
          activeStyle.supportsLightPreset ? "text-white/60" : "text-white/30"
        }`}
      >
        <Sun size={11} strokeWidth={1.8} aria-hidden />
        Light
        {!activeStyle.supportsLightPreset ? (
          <span className="ml-1 text-[8px] font-normal normal-case tracking-normal text-white/40">
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
          const disabled = !activeStyle.supportsLightPreset;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              disabled={disabled}
              onClick={() => onChange({ ...settings, lightPreset: value })}
              className="flex flex-col items-center justify-center gap-0.5 rounded-md px-1.5 py-2 text-[10px] font-medium text-white/80 transition-colors enabled:hover:bg-white/10 disabled:opacity-40"
              style={
                active && !disabled
                  ? { backgroundColor: primary, color: "#0b1220" }
                  : undefined
              }
            >
              <Icon size={13} strokeWidth={1.8} aria-hidden />
              {label}
            </button>
          );
        })}
      </div>

      {/* Toggles */}
      <div className="mt-4 space-y-1">
        <PanelToggle
          icon={Mountain}
          label="Terrain"
          checked={settings.showTerrain}
          onChange={(showTerrain) => onChange({ ...settings, showTerrain })}
          primary={primary}
        />
        <PanelToggle
          icon={Box}
          label="3D buildings"
          checked={settings.show3dBuildings}
          onChange={(show3dBuildings) =>
            onChange({ ...settings, show3dBuildings })
          }
          disabled={!activeStyle.supports3dObjects}
          disabledHint="Standard / Satellite only"
          primary={primary}
        />
      </div>

      <button
        type="button"
        onClick={() => onChange(DEFAULT_SETTINGS)}
        className="mt-3 w-full rounded-md border border-white/15 px-3 py-1.5 text-[11px] font-medium text-white/60 transition-colors hover:border-white/30 hover:text-white/85"
      >
        Reset to defaults
      </button>
    </div>
  );
}

function PanelToggle({
  icon: Icon,
  label,
  checked,
  onChange,
  disabled,
  disabledHint,
  primary,
}: {
  icon: typeof Sun;
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  disabledHint?: string;
  primary: string;
}) {
  return (
    <label
      className={`flex items-center justify-between rounded-md px-2 py-1.5 transition-colors ${
        disabled ? "opacity-40" : "cursor-pointer hover:bg-white/5"
      }`}
    >
      <span className="inline-flex items-center gap-2 text-white/90">
        <Icon size={12} strokeWidth={1.8} aria-hidden />
        {label}
        {disabled && disabledHint ? (
          <span className="text-[9px] text-white/40">({disabledHint})</span>
        ) : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          checked ? "" : "border border-white/25 bg-transparent"
        }`}
        style={checked && !disabled ? { backgroundColor: primary } : undefined}
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

/* ───────────────────── Device drawer ──────────────────────────── */

function DeviceDrawer({
  device,
  primary,
  bg,
  onClose,
}: {
  device: PublicWorldDevice | null;
  primary: string;
  bg: string;
  onClose: () => void;
}) {
  if (!device) return null;
  const Icon =
    device.subsystem === "cctv"
      ? Camera
      : device.subsystem === "dms"
        ? Signpost
        : Radio;

  return (
    <aside
      className="absolute bottom-0 left-0 right-0 z-10 mx-auto max-w-[640px] rounded-t-2xl border border-white/10 bg-[var(--world-bg)]/95 p-5 text-white shadow-2xl backdrop-blur md:bottom-4 md:left-4 md:right-auto md:w-[360px] md:rounded-2xl"
      style={{ ["--world-bg" as string]: bg }}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `${primary}33`, color: primary }}
        >
          <Icon size={16} strokeWidth={1.8} aria-hidden />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/50">
            {device.subsystem.toUpperCase()}
          </p>
          <h2 className="mt-0.5 truncate text-sm font-semibold">{device.name}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-full p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft size={14} strokeWidth={1.8} aria-hidden />
        </button>
      </div>

      <dl className="mt-3 space-y-1.5 text-xs">
        {device.primaryRoad ? (
          <Row label="Road" value={device.primaryRoad} />
        ) : null}
        {device.crossRoad ? (
          <Row label="Cross" value={device.crossRoad} />
        ) : null}
        {device.direction ? (
          <Row label="Direction" value={device.direction} />
        ) : null}
        {device.lat != null && device.lng != null ? (
          <Row
            label={
              <span className="inline-flex items-center gap-1">
                <MapPin size={10} strokeWidth={1.8} aria-hidden />
                Coords
              </span>
            }
            value={`${device.lat.toFixed(4)}, ${device.lng.toFixed(4)}`}
          />
        ) : null}
      </dl>
    </aside>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-white/50">{label}</dt>
      <dd className="truncate font-medium text-white/90">{value}</dd>
    </div>
  );
}
