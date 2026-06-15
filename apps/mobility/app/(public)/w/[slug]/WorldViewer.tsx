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
import { loadDeviceIconsIntoMap } from "@/lib/mobility/load-device-icons";
import {
  createThreeDeviceLayer,
  THREE_DEVICE_LAYER_ID,
  type ThreeDeviceLayer,
} from "@/lib/mobility/three-device-layer";
import { PushOptIn } from "./PushOptIn";

interface Props {
  slug: string;
  name: string;
  description: string | null;
  devices: PublicWorldDevice[];
  theme: Record<string, unknown>;
  mapboxToken: string | null;
  /** Subsystem → iconKey, resolved server-side from the operator's
   *  project-level styles. */
  styleIcons: Record<string, string>;
  /** Per-id descriptor of custom uploads referenced by the project. */
  customIcons: Record<string, import("@/lib/mobility/device-style-resolver").CustomIconRef>;
  /** Subsystem → 3D modelKey. Phase 3 — used when the visitor turns
   *  on the "3D devices" toggle. */
  styleModels: Record<string, string>;
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
  show3dDevices: false,
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

/** Expand `#rgb` → `#rrggbb` so the channel reads below stay uniform. */
function expandHex(hex: string): string {
  if (hex.length === 7) return hex;
  const body = hex.slice(1);
  return `#${body[0]}${body[0]}${body[1]}${body[1]}${body[2]}${body[2]}`;
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

function hexToRgb(hex: string): RGB {
  const h = expandHex(hex).slice(1);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgba({ r, g, b }: RGB, a: number): string {
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Perceived brightness — drives the fg/border choice so the operator
 *  can paint a world bright or dark and the chrome reads either way. */
function isLight({ r, g, b }: RGB): boolean {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55;
}

/**
 * Derive every chrome colour from the operator's two picks. Returned
 * as a flat record of CSS custom properties so the viewer can drop
 * them onto a single style block on `<main>` and every descendant
 * info-box / button reads them via `var(--w-*)` instead of hard-coded
 * `text-white` / `bg-black` classes that fight a bright theme.
 */
function deriveWorldPalette(bg: string, primary: string): Record<string, string> {
  const bgRgb = hexToRgb(bg);
  const primaryRgb = hexToRgb(primary);
  const light = isLight(bgRgb);
  const fgBase: RGB = light ? { r: 11, g: 18, b: 32 } : { r: 245, g: 247, b: 250 };
  const accentContrast: RGB = isLight(primaryRgb)
    ? { r: 11, g: 18, b: 32 }
    : { r: 255, g: 255, b: 255 };
  return {
    "--w-bg": bg,
    "--w-fg": rgba(fgBase, 0.95),
    "--w-fg-soft": rgba(fgBase, 0.72),
    "--w-fg-muted": rgba(fgBase, 0.5),
    "--w-border": rgba(fgBase, light ? 0.14 : 0.16),
    "--w-border-strong": rgba(fgBase, light ? 0.22 : 0.28),
    "--w-overlay": rgba(fgBase, light ? 0.06 : 0.08),
    "--w-accent": primary,
    "--w-accent-soft": rgba(primaryRgb, 0.18),
    "--w-accent-contrast": rgba(accentContrast, 1),
  };
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
function buildIconExpression(
  styleIcons: Record<string, string>,
): mapboxgl.ExpressionSpecification {
  const pairs: Array<string> = [];
  for (const [subsystem, iconKey] of Object.entries(styleIcons)) {
    pairs.push(subsystem, `device-${iconKey}`);
  }
  return [
    "match",
    ["get", "subsystem"],
    ...(pairs as [string, string, ...string[]]),
    "device-generic",
  ] as unknown as mapboxgl.ExpressionSpecification;
}

function setupDeviceLayers(
  map: MapboxMap,
  primary: string,
  selectedId: string | null,
  data: GeoJSON.FeatureCollection<GeoJSON.Point>,
  iconExpression: mapboxgl.ExpressionSpecification,
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
  // Selection halo — drawn beneath the symbol so the icon sits on
  // top crisply when a visitor picks a device.
  map.addLayer({
    id: SELECTED_LAYER,
    type: "circle",
    source: SOURCE_ID,
    filter: ["==", ["get", "id"], selectedId ?? NO_SELECTION],
    paint: {
      "circle-color": primary,
      "circle-opacity": 0.28,
      "circle-radius": 18,
      "circle-stroke-color": primary,
      "circle-stroke-width": 2,
    },
  });
  // Device markers — SDF icon, tinted with the world's primary
  // colour so the operator's brand carries through.
  map.addLayer({
    id: POINT_LAYER,
    type: "symbol",
    source: SOURCE_ID,
    filter: ["!", ["has", "point_count"]],
    layout: {
      "icon-image": iconExpression,
      "icon-size": [
        "interpolate",
        ["linear"],
        ["zoom"],
        8,
        0.2,
        12,
        0.3,
        16,
        0.46,
      ],
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
    },
    paint: {
      "icon-color": primary,
      "icon-halo-color": "rgba(0, 0, 0, 0.5)",
      "icon-halo-width": 1.5,
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
  styleIcons,
  customIcons,
  styleModels,
}: Props) {
  const primary = pickHex(theme.primaryColor, DEFAULT_PRIMARY);
  const bg = pickHex(theme.backgroundColor, DEFAULT_BG);
  const logoUrl = typeof theme.logoUrl === "string" ? theme.logoUrl : null;
  const tagline = typeof theme.tagline === "string" ? theme.tagline : null;
  /** Operator-driven palette as CSS variables. Set once on `<main>`
   *  so every info box can read `var(--w-fg)` etc. instead of fighting
   *  hard-coded text-white / bg-black classes. */
  const paletteStyle = useMemo(() => deriveWorldPalette(bg, primary), [bg, primary]);

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

  const iconExpression = useMemo(
    () => buildIconExpression(styleIcons),
    [styleIcons],
  );
  const latestIconExpressionRef = useRef(iconExpression);
  latestIconExpressionRef.current = iconExpression;
  const customIconsRef = useRef(customIcons);
  customIconsRef.current = customIcons;
  const styleModelsRef = useRef(styleModels);
  styleModelsRef.current = styleModels;
  const threeLayerRef = useRef<ThreeDeviceLayer | null>(null);

  /** Push the world's curated devices into the Three.js layer using
   *  the resolved per-subsystem model map. */
  const pushDevicesTo3d = useCallback(() => {
    const layer = threeLayerRef.current;
    if (!layer) return;
    const located = devices.filter(
      (d): d is PublicWorldDevice & { lat: number; lng: number } =>
        d.lat != null && d.lng != null,
    );
    layer.setDevices(
      located.map((d) => ({
        id: d.id,
        lat: d.lat,
        lng: d.lng,
        subsystem: d.subsystem,
      })),
      (subsystem) => styleModelsRef.current[subsystem] ?? "model-generic",
    );
    layer.setAccent(primary);
  }, [devices, primary]);

  const attachLayers = useCallback(
    (map: MapboxMap) => {
      setupDeviceLayers(
        map,
        primary,
        latestSelectedRef.current,
        latestDataRef.current,
        latestIconExpressionRef.current,
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
      void loadDeviceIconsIntoMap(map, customIconsRef.current).then(() => {
        attachLayers(map);
        fitToDevices(map, devices);
      });
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
      void loadDeviceIconsIntoMap(map, customIconsRef.current).then(() =>
        attachLayers(map),
      );
    });
  }, [settings.mapStyle, attachLayers]);

  // Live icon-mapping swap — if the operator changes a style on
  // another tab and the viewer is hot-reloaded (or PR2 of the next
  // arc plumbs a live channel), update the layout without a layer
  // rebuild.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layersReadyRef.current) return;
    if (!map.getLayer(POINT_LAYER)) return;
    try {
      map.setLayoutProperty(POINT_LAYER, "icon-image", iconExpression);
    } catch {
      /* style swap in-flight */
    }
  }, [iconExpression]);

  /** 3D device layer — mount/unmount with the visitor's setting. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const want = settings.show3dDevices;
    const have = Boolean(threeLayerRef.current);
    if (want && !have) {
      const apply = () => {
        if (!map.isStyleLoaded()) {
          map.once("idle", apply);
          return;
        }
        const layer = createThreeDeviceLayer();
        threeLayerRef.current = layer;
        try {
          map.addLayer(layer);
        } catch {
          /* race with style swap — retry on next idle */
        }
        pushDevicesTo3d();
      };
      apply();
    } else if (!want && have) {
      try {
        if (map.getLayer(THREE_DEVICE_LAYER_ID)) {
          map.removeLayer(THREE_DEVICE_LAYER_ID);
        }
      } catch {
        /* already gone */
      }
      threeLayerRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.show3dDevices]);

  useEffect(() => {
    pushDevicesTo3d();
  }, [pushDevicesTo3d]);

  useEffect(() => {
    threeLayerRef.current?.setHighlight(selectedId);
  }, [selectedId]);

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
        className="flex w-full items-center justify-center p-8 text-center text-sm"
        style={{
          height: "100dvh",
          backgroundColor: bg,
          color: "var(--w-fg)",
          ...paletteStyle,
        }}
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
      //
      // The `--w-*` palette is plumbed once here so every floating
      // info box can theme off it without hard-coded colours.
      style={{ height: "100dvh", backgroundColor: bg, ...paletteStyle }}
    >
      <div
        ref={mapEl}
        className="absolute inset-0"
        style={{ width: "100%", height: "100%" }}
      />

      {/* World title — top-left card. Kept compact so it doesn't
          dominate the map; the install prompt + drawer live elsewhere.
          All colours read from the `--w-*` palette so a light theme
          renders dark text on a bright card and vice versa. */}
      <header
        className="pointer-events-none absolute left-4 top-4 max-w-[min(86%,360px)] rounded-2xl border px-4 py-3 shadow-lg backdrop-blur"
        style={{
          borderColor: "var(--w-border)",
          backgroundColor: "color-mix(in srgb, var(--w-bg) 85%, transparent)",
          color: "var(--w-fg)",
        }}
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
          <p
            className="text-[10px] font-medium uppercase tracking-[0.22em]"
            style={{ color: "var(--w-fg-muted)" }}
          >
            Klorad Mobility
          </p>
        </div>
        <h1 className="mt-1 text-base font-semibold">{name}</h1>
        {tagline || description ? (
          <p
            className="mt-1 line-clamp-2 text-xs"
            style={{ color: "var(--w-fg-soft)" }}
          >
            {tagline || description}
          </p>
        ) : null}
        <p className="mt-1.5 text-[11px]" style={{ color: "var(--w-fg-muted)" }}>
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
        className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full border shadow-lg backdrop-blur transition-colors"
        style={{
          borderColor: open ? primary : "var(--w-border-strong)",
          backgroundColor: open
            ? "var(--w-accent-soft)"
            : "color-mix(in srgb, var(--w-bg) 78%, transparent)",
          color: open ? primary : "var(--w-fg)",
        }}
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
    <div
      className="pointer-events-auto w-[280px] rounded-2xl border p-4 text-xs shadow-2xl backdrop-blur"
      style={{
        borderColor: "var(--w-border-strong)",
        backgroundColor:
          "color-mix(in srgb, var(--w-bg) 92%, transparent)",
        color: "var(--w-fg)",
      }}
    >
      {/* Style */}
      <p
        className="mb-1.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.22em]"
        style={{ color: "var(--w-fg-muted)" }}
      >
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
              className="rounded-md px-1.5 py-2 text-[10px] font-medium transition-colors"
              style={
                active
                  ? {
                      backgroundColor: primary,
                      color: "var(--w-accent-contrast)",
                    }
                  : {
                      color: "var(--w-fg-soft)",
                      backgroundColor: "transparent",
                    }
              }
            >
              <span className="block">{def.label}</span>
              <span
                className="mt-0.5 block text-[9px] font-normal"
                style={{
                  color: active
                    ? "var(--w-accent-contrast)"
                    : "var(--w-fg-muted)",
                  opacity: active ? 0.85 : 1,
                }}
              >
                {def.description}
              </span>
            </button>
          );
        })}
      </div>

      {/* Light */}
      <p
        className="mt-4 mb-1.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.22em]"
        style={{
          color: activeStyle.supportsLightPreset
            ? "var(--w-fg-muted)"
            : "var(--w-fg-muted)",
          opacity: activeStyle.supportsLightPreset ? 1 : 0.55,
        }}
      >
        <Sun size={11} strokeWidth={1.8} aria-hidden />
        Light
        {!activeStyle.supportsLightPreset ? (
          <span
            className="ml-1 text-[8px] font-normal normal-case tracking-normal"
            style={{ color: "var(--w-fg-muted)", opacity: 0.75 }}
          >
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
              className="flex flex-col items-center justify-center gap-0.5 rounded-md px-1.5 py-2 text-[10px] font-medium transition-colors disabled:opacity-40"
              style={
                active && !disabled
                  ? {
                      backgroundColor: primary,
                      color: "var(--w-accent-contrast)",
                    }
                  : {
                      color: "var(--w-fg-soft)",
                      backgroundColor: "transparent",
                    }
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
        <PanelToggle
          icon={Box}
          label="3D devices"
          checked={settings.show3dDevices}
          onChange={(show3dDevices) =>
            onChange({ ...settings, show3dDevices })
          }
          primary={primary}
        />
      </div>

      <button
        type="button"
        onClick={() => onChange(DEFAULT_SETTINGS)}
        className="mt-3 w-full rounded-md border px-3 py-1.5 text-[11px] font-medium transition-colors"
        style={{
          borderColor: "var(--w-border)",
          color: "var(--w-fg-muted)",
        }}
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
        disabled ? "opacity-40" : "cursor-pointer"
      }`}
    >
      <span
        className="inline-flex items-center gap-2"
        style={{ color: "var(--w-fg)" }}
      >
        <Icon size={12} strokeWidth={1.8} aria-hidden />
        {label}
        {disabled && disabledHint ? (
          <span
            className="text-[9px]"
            style={{ color: "var(--w-fg-muted)" }}
          >
            ({disabledHint})
          </span>
        ) : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors"
        style={{
          backgroundColor:
            checked && !disabled ? primary : "transparent",
          borderColor:
            checked && !disabled ? primary : "var(--w-border-strong)",
        }}
      >
        <span
          aria-hidden
          className={`h-4 w-4 rounded-full shadow-sm transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
          style={{
            backgroundColor:
              checked && !disabled
                ? "var(--w-accent-contrast)"
                : "var(--w-fg-soft)",
          }}
        />
      </button>
    </label>
  );
}

/* ───────────────────── Device drawer ──────────────────────────── */

function DeviceDrawer({
  device,
  primary,
  onClose,
}: {
  device: PublicWorldDevice | null;
  primary: string;
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
      className="absolute bottom-0 left-0 right-0 z-10 mx-auto max-w-[640px] rounded-t-2xl border p-5 shadow-2xl backdrop-blur md:bottom-4 md:left-4 md:right-auto md:w-[360px] md:rounded-2xl"
      style={{
        borderColor: "var(--w-border)",
        backgroundColor: "color-mix(in srgb, var(--w-bg) 94%, transparent)",
        color: "var(--w-fg)",
      }}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: "var(--w-accent-soft)", color: primary }}
        >
          <Icon size={16} strokeWidth={1.8} aria-hidden />
        </span>
        <div className="flex-1 min-w-0">
          <p
            className="text-[10px] font-medium uppercase tracking-[0.22em]"
            style={{ color: "var(--w-fg-muted)" }}
          >
            {device.subsystem.toUpperCase()}
          </p>
          <h2 className="mt-0.5 truncate text-sm font-semibold">{device.name}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-full p-1 transition-colors"
          style={{ color: "var(--w-fg-muted)" }}
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
      <dt style={{ color: "var(--w-fg-muted)" }}>{label}</dt>
      <dd className="truncate font-medium" style={{ color: "var(--w-fg)" }}>
        {value}
      </dd>
    </div>
  );
}
