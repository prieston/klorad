"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import mapboxgl, {
  type GeoJSONSource,
  type Map as MapboxMap,
  type MapMouseEvent,
} from "mapbox-gl";
import {
  ArrowLeft,
  Box,
  Info,
  Layers as LayersIcon,
  MapPin,
  Moon,
  Mountain,
  Settings,
  Sun,
  Sunrise,
  Sunset,
} from "lucide-react";
import useSWR from "swr";
import { subsystemIcon } from "@/lib/mobility/subsystem-icon";
import type { PublicWorldDevice } from "@/lib/mobility/world-resolver";
import { DeviceLiveDetail } from "@/lib/mobility/DeviceLiveDetail";
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

import {
  deriveWorldPalette,
  worldPickHex,
} from "@/lib/mobility/world-palette";

const DEFAULT_PRIMARY = "#0ea5e9";
const DEFAULT_BG = "#0b1220";

const SOURCE_ID = "world-devices";
const CLUSTER_LAYER = "world-clusters";
const CLUSTER_COUNT_LAYER = "world-cluster-count";
const POINT_LAYER = "world-points";
const SELECTED_LAYER = "world-points-selected";
const NO_SELECTION = "__none__";
/** Second, unclustered source containing only the currently-selected
 *  devices. Needed because the primary source is clustered, so a
 *  selected pin that happens to be inside a cluster wouldn't render
 *  its halo — the individual point feature is hidden behind the
 *  cluster bubble. This source stays flat so its halo always draws. */
const SELECTED_SOURCE_ID = "world-devices-selected";
const SELECTED_HALO_LAYER = "world-devices-selected-halo";
const SELECTED_PIN_LAYER = "world-devices-selected-pin";

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

// Palette + hex helpers live in `lib/mobility/world-palette.ts` so
// the layout can inject the same `--w-*` vars for the Devices /
// Notifications / Paris tabs where the WorldViewer isn't mounted.

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

/** Filter that highlights every id in `ids`. Mapbox `in` with a
 *  `literal` array is the cheap way — no re-adding the layer when
 *  the set changes, just `setFilter`. Empty set → matches nothing. */
function buildSelectionFilter(
  ids: string[],
): mapboxgl.FilterSpecification {
  if (ids.length === 0) {
    return ["==", ["get", "id"], NO_SELECTION];
  }
  return [
    "in",
    ["get", "id"],
    ["literal", ids],
  ] as unknown as mapboxgl.FilterSpecification;
}

function setupDeviceLayers(
  map: MapboxMap,
  primary: string,
  highlightIds: string[],
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
  // top crisply. Covers both the single tap-selected pin and any
  // externally-highlighted devices from `?devices=<id,id,...>` (used
  // by notification deep-links).
  map.addLayer({
    id: SELECTED_LAYER,
    type: "circle",
    source: SOURCE_ID,
    filter: buildSelectionFilter(highlightIds),
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

  // Secondary unclustered source + halo + always-on pin for the
  // selected devices. Rendered ABOVE the cluster layer so the
  // selection is visible even when the underlying point feature is
  // still bundled inside a cluster bubble at low zoom. The source
  // starts empty; `setSelectedFeatures` updates it whenever selection
  // changes.
  map.addSource(SELECTED_SOURCE_ID, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });
  map.addLayer({
    id: SELECTED_HALO_LAYER,
    type: "circle",
    source: SELECTED_SOURCE_ID,
    paint: {
      "circle-color": primary,
      "circle-opacity": 0.28,
      // Larger than the biggest cluster bubble (28 px at 100+
      // points) so the halo extends beyond the cluster ring when
      // the selected pin is still bundled inside one at low zoom.
      // Otherwise the halo was entirely hidden behind the bubble.
      "circle-radius": 34,
      "circle-stroke-color": primary,
      "circle-stroke-width": 3,
    },
  });
  map.addLayer({
    id: SELECTED_PIN_LAYER,
    type: "symbol",
    source: SELECTED_SOURCE_ID,
    layout: {
      "icon-image": iconExpression,
      // A touch bigger than the base points at every zoom so a
      // selected pin still reads clearly when the cluster bubble is
      // painted over the same coordinate.
      "icon-size": [
        "interpolate",
        ["linear"],
        ["zoom"],
        8,
        0.28,
        12,
        0.4,
        16,
        0.56,
      ],
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
    },
    paint: {
      "icon-color": primary,
      "icon-halo-color": "rgba(0, 0, 0, 0.55)",
      "icon-halo-width": 2,
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
  // Selected-pin layer sits above the cluster so it swallows clicks
  // over the same coordinate — the visitor tapping the highlighted
  // pin lands on the drawer, not on a cluster expansion.
  map.on("click", SELECTED_PIN_LAYER, (e: MapMouseEvent) => {
    const feature = (e.features ?? [])[0];
    const id = feature?.properties?.id as string | undefined;
    if (id) onPointClick(id);
  });
  map.on("click", (e: MapMouseEvent) => {
    const hits = map.queryRenderedFeatures(e.point, {
      layers: [POINT_LAYER, CLUSTER_LAYER, SELECTED_PIN_LAYER],
    });
    if (hits.length === 0) onBackgroundClick();
  });
  for (const layer of [POINT_LAYER, CLUSTER_LAYER, SELECTED_PIN_LAYER]) {
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
  const primary = worldPickHex(theme.primaryColor, DEFAULT_PRIMARY);
  const bg = worldPickHex(theme.backgroundColor, DEFAULT_BG);
  const tagline = typeof theme.tagline === "string" ? theme.tagline : null;
  /** Operator-driven palette as CSS variables. Set once on `<main>`
   *  so every info box can read `var(--w-fg)` etc. instead of fighting
   *  hard-coded text-white / bg-black classes. */
  const paletteStyle = useMemo(() => deriveWorldPalette(bg, primary), [bg, primary]);

  const pathname = usePathname();
  const searchParams = useSearchParams();

  /** Initial state read from URL — parsed once on mount so we don't
   *  re-run when the user pans the map (we update the URL via
   *  history.replaceState in that case, which doesn't re-invoke this
   *  hook). This is what makes every shareable link reproduce the
   *  same map state on load. */
  const initialUrlStateRef = useRef<{
    device: string | null;
    devices: string[];
    lng: number | null;
    lat: number | null;
    zoom: number | null;
  } | null>(null);
  if (initialUrlStateRef.current === null) {
    const dev = searchParams?.get("device") ?? null;
    const devicesParam = searchParams?.get("devices") ?? "";
    const devices = devicesParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const lng = parseFloat(searchParams?.get("lng") ?? "");
    const lat = parseFloat(searchParams?.get("lat") ?? "");
    const zoom = parseFloat(searchParams?.get("z") ?? "");
    initialUrlStateRef.current = {
      device: dev,
      devices,
      lng: Number.isFinite(lng) ? lng : null,
      lat: Number.isFinite(lat) ? lat : null,
      zoom: Number.isFinite(zoom) ? zoom : null,
    };
  }
  const initialUrlState = initialUrlStateRef.current;

  /** Highlight set from `?devices=` — used by notification deep-links.
   *  Stays constant once mounted; visitor taps only mutate
   *  `selectedId`. Combined with `selectedId` when computing the halo
   *  filter so a visitor tapping a different pin doesn't wipe the
   *  externally-supplied highlight. */
  const [highlightIds] = useState<Set<string>>(
    () => new Set(initialUrlState.devices),
  );

  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const layersReadyRef = useRef(false);

  const [selectedId, setSelectedId] = useState<string | null>(
    initialUrlState.device,
  );
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
      const currentFilterIds = Array.from(
        new Set(
          [latestSelectedRef.current, ...highlightIds].filter(
            (id): id is string => Boolean(id),
          ),
        ),
      );
      setupDeviceLayers(
        map,
        primary,
        currentFilterIds,
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
    [primary, highlightIds],
  );

  // Init map once. Camera + selection may be seeded from the URL so
  // shared links reproduce state on load.
  useEffect(() => {
    if (!mapboxToken || !mapEl.current || mapRef.current) return;
    mapboxgl.accessToken = mapboxToken;
    const initialStyle = MAP_STYLES[latestSettingsRef.current.mapStyle].url;
    const urlCam =
      initialUrlState.lng != null &&
      initialUrlState.lat != null &&
      initialUrlState.zoom != null;
    const map = new mapboxgl.Map({
      container: mapEl.current,
      style: initialStyle,
      center: urlCam
        ? [initialUrlState.lng!, initialUrlState.lat!]
        : [22.9444, 40.6401],
      zoom: urlCam ? initialUrlState.zoom! : 11,
      pitch: 30,
      maxPitch: 85,
      attributionControl: false,
    });
    mapRef.current = map;

    map.on("load", () => {
      applyMapEnvSettings(map, latestSettingsRef.current);
      void loadDeviceIconsIntoMap(map, customIconsRef.current).then(() => {
        attachLayers(map);
        if (urlCam) {
          // Camera already seeded from URL — no auto-frame.
          return;
        }
        // Deep-link priority:
        //   1. ?devices=X,Y,Z — fit bounds around the highlighted set
        //      (notification tap-through lands here).
        //   2. ?device=<id>   — close-up on that one pin.
        //   3. Fall back to fit-all.
        if (highlightIds.size > 0) {
          const highlightDevices = devices.filter(
            (d) =>
              highlightIds.has(d.id) && d.lat != null && d.lng != null,
          );
          if (highlightDevices.length > 0) {
            fitToDevices(map, highlightDevices);
            return;
          }
        }
        const seed = initialUrlState.device
          ? devices.find(
              (d) =>
                d.id === initialUrlState.device &&
                d.lat != null &&
                d.lng != null,
            )
          : null;
        if (seed && seed.lat != null && seed.lng != null) {
          map.flyTo({
            center: [seed.lng, seed.lat],
            zoom: 17,
            duration: 0,
          });
        } else {
          fitToDevices(map, devices);
        }
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
      layersReadyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- init-once
  }, [mapboxToken]);

  /** Serialize the current map + selection into the URL. Uses
   *  history.replaceState (not Next router) so map moveend doesn't
   *  re-invoke the server page / re-fetch devices — the URL bar
   *  updates in place. Debounced so a pan doesn't spam history. */
  const urlWriteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const writeUrlState = useCallback(() => {
    if (typeof window === "undefined") return;
    const map = mapRef.current;
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (map) {
      const c = map.getCenter();
      params.set("lng", c.lng.toFixed(5));
      params.set("lat", c.lat.toFixed(5));
      params.set("z", map.getZoom().toFixed(2));
    }
    if (latestSelectedRef.current) {
      params.set("device", latestSelectedRef.current);
    } else {
      params.delete("device");
    }
    const q = params.toString();
    const url = q ? `${pathname}?${q}` : (pathname ?? "");
    window.history.replaceState(null, "", url);
  }, [pathname, searchParams]);

  const scheduleUrlWrite = useCallback(() => {
    if (urlWriteTimerRef.current) clearTimeout(urlWriteTimerRef.current);
    urlWriteTimerRef.current = setTimeout(writeUrlState, 200);
  }, [writeUrlState]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.on("moveend", scheduleUrlWrite);
    map.on("zoomend", scheduleUrlWrite);
    return () => {
      map.off("moveend", scheduleUrlWrite);
      map.off("zoomend", scheduleUrlWrite);
    };
  }, [scheduleUrlWrite, mapboxToken]);

  useEffect(() => {
    writeUrlState();
  }, [selectedId, writeUrlState]);

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
    const ids = Array.from(
      new Set(
        [selectedId, ...highlightIds].filter(
          (id): id is string => Boolean(id),
        ),
      ),
    );
    // Halo on the clustered source — hidden inside a cluster bubble
    // at low zoom, but still useful when the pin is unclustered.
    map.setFilter(SELECTED_LAYER, buildSelectionFilter(ids));

    // Unclustered "always visible" copy of the selected features.
    // Keeps the halo + a bolder pin rendered on top of the cluster
    // bubble, so the visitor can see which pin they picked even when
    // Mapbox is still bundling it with neighbours.
    const selectedSource = map.getSource(SELECTED_SOURCE_ID) as
      | GeoJSONSource
      | undefined;
    if (selectedSource) {
      const selectedFeatures: GeoJSON.Feature<GeoJSON.Point>[] = devices
        .filter(
          (d): d is PublicWorldDevice & { lat: number; lng: number } =>
            ids.includes(d.id) && d.lat != null && d.lng != null,
        )
        .map((d) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [d.lng, d.lat] },
          properties: {
            id: d.id,
            name: d.name,
            subsystem: d.subsystem,
          },
        }));
      selectedSource.setData({
        type: "FeatureCollection",
        features: selectedFeatures,
      });
    }
  }, [selectedId, highlightIds, devices]);

  // React to external URL changes. Notification taps navigate to
  // `/w/<slug>?device=<id>` — that's a Next.js soft nav which
  // updates `searchParams` here. Our own moveend/select writes go
  // through `history.replaceState`, which does NOT re-run this hook,
  // so there's no risk of a feedback loop between URL writes and
  // this reader.
  useEffect(() => {
    const urlDeviceId = searchParams?.get("device") ?? null;
    if (urlDeviceId !== selectedId) {
      setSelectedId(urlDeviceId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reading URL, writing state
  }, [searchParams]);

  // Fly-to on selection change. Runs whenever `selectedId` transitions
  // from null → id or id → different id (including a fresh URL nav
  // from a notification tap). Skipped for the initial mount because
  // the map-init effect already places the camera; this only kicks
  // in for subsequent user or deep-link driven selections.
  const didInitialFlyRef = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layersReadyRef.current) return;
    if (!didInitialFlyRef.current) {
      didInitialFlyRef.current = true;
      return;
    }
    if (!selectedId) return;
    const device = devices.find(
      (d): d is PublicWorldDevice & { lat: number; lng: number } =>
        d.id === selectedId && d.lat != null && d.lng != null,
    );
    if (!device) return;
    // Zoom past the cluster breakpoint (14) so the pin comes out of
    // any cluster it might be in. Smooth so the visitor sees the
    // motion instead of teleporting.
    map.flyTo({
      center: [device.lng, device.lat],
      zoom: Math.max(map.getZoom(), 17),
      duration: 900,
      essential: true,
    });
  }, [selectedId, devices]);

  if (!mapboxToken) {
    return (
      <main
        className="flex w-full items-center justify-center p-8 text-center text-sm"
        style={{
          height: "calc(100dvh - 3.5rem)",
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
      // `data-mapbox` opts this surface out of `MobilityPullToRefresh`
      // so a downward pan on the map doesn't trigger `router.refresh`.
      // Selector match happens in the DS `PullToRefresh` primitive.
      data-mapbox
      className="relative w-full overflow-hidden"
      // Height reserves 3.5rem for the sticky top nav so the map fits
      // exactly between the top nav and the viewport bottom — without
      // this the total document is `100dvh + 3.5rem` and the whole
      // page picks up an unwanted 3.5rem scrollbar. Inline `height`
      // (not Tailwind arbitrary values) because the JIT can purge
      // one-off arbitrary heights and Mapbox needs a measurable
      // container before init — a collapsed canvas paints as a blank
      // screen.
      //
      // The `--w-*` palette is plumbed once here so every floating
      // info box can theme off it without hard-coded colours.
      style={{
        height: "calc(100dvh - 3.5rem)",
        backgroundColor: bg,
        ...paletteStyle,
      }}
    >
      <div
        ref={mapEl}
        className="absolute inset-0"
        style={{ width: "100%", height: "100%" }}
      />

      <MapSettingsButton
        primary={primary}
        settings={settings}
        onChange={setSettings}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        worldName={name}
        worldTagline={tagline ?? description ?? null}
        worldSlug={slug}
        deviceCount={devices.length}
      />

      <DeviceDrawer
        slug={slug}
        device={selected}
        primary={primary}
        onClose={() => setSelectedId(null)}
        onRecenter={() => {
          const map = mapRef.current;
          if (!map || !selected || selected.lat == null || selected.lng == null)
            return;
          map.flyTo({
            center: [selected.lng, selected.lat],
            zoom: Math.max(map.getZoom(), 17),
            duration: 900,
            essential: true,
          });
        }}
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
  worldName,
  worldTagline,
  worldSlug,
  deviceCount,
}: {
  primary: string;
  settings: MapEnvSettings;
  onChange: (next: MapEnvSettings) => void;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  worldName: string;
  worldTagline: string | null;
  worldSlug: string;
  deviceCount: number;
}) {
  const styleDef = MAP_STYLES[settings.mapStyle];
  return (
    // Lifted above the mobile bottom nav (`bar` variant is ~3.5rem +
    // safe area). Desktop keeps a tight 1rem gap from the viewport
    // corner since the bottom nav is `md:hidden`.
    <div className="absolute right-4 z-20 flex flex-col items-end gap-2 bottom-[calc(3.5rem+env(safe-area-inset-bottom)+0.75rem)] md:bottom-4">
      {open ? (
        <MapSettingsPanel
          primary={primary}
          settings={settings}
          onChange={onChange}
          worldName={worldName}
          worldTagline={worldTagline}
          worldSlug={worldSlug}
          deviceCount={deviceCount}
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
  worldName,
  worldTagline,
  worldSlug,
  deviceCount,
}: {
  primary: string;
  settings: MapEnvSettings;
  onChange: (next: MapEnvSettings) => void;
  worldName: string;
  worldTagline: string | null;
  worldSlug: string;
  deviceCount: number;
}) {
  const activeStyle = MAP_STYLES[settings.mapStyle];
  return (
    <div
      className="pointer-events-auto max-h-[calc(100dvh-14rem)] w-[300px] overflow-y-auto rounded-2xl border p-4 text-xs shadow-2xl backdrop-blur"
      style={{
        borderColor: "var(--w-border-strong)",
        backgroundColor:
          "color-mix(in srgb, var(--w-bg) 92%, transparent)",
        color: "var(--w-fg)",
      }}
    >
      {/* World info — moved out of the old top-left header card so
          the map has a clean canvas. Panel opens on demand instead. */}
      <p
        className="mb-1.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.22em]"
        style={{ color: "var(--w-fg-muted)" }}
      >
        <Info size={11} strokeWidth={1.8} aria-hidden />
        World
      </p>
      <div
        className="mb-4 rounded-xl border p-3"
        style={{
          borderColor: "var(--w-border)",
          backgroundColor: "var(--w-overlay)",
        }}
      >
        <p className="text-sm font-semibold" style={{ color: "var(--w-fg)" }}>
          {worldName}
        </p>
        {worldTagline ? (
          <p
            className="mt-0.5 line-clamp-2 text-[11px]"
            style={{ color: "var(--w-fg-soft)" }}
          >
            {worldTagline}
          </p>
        ) : null}
        <p
          className="mt-2 text-[11px]"
          style={{ color: "var(--w-fg-muted)" }}
        >
          <span style={{ color: primary }}>{deviceCount}</span>{" "}
          {deviceCount === 1 ? "device" : "devices"}
        </p>
        <p
          className="mt-1 truncate font-mono text-[10px]"
          style={{ color: "var(--w-fg-muted)" }}
          title={`/w/${worldSlug}`}
        >
          /w/{worldSlug}
        </p>
      </div>

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

interface LiveResponse {
  status: {
    online: boolean;
    alarm: string | null;
    observedAt: string;
    raw: Record<string, unknown>;
  } | null;
  media?: {
    kind?: string;
    url?: string;
  } | null;
}

const drawerFetcher = (url: string) =>
  fetch(url).then(async (r) => {
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  });

function DeviceDrawer({
  slug,
  device,
  primary,
  onClose,
  onRecenter,
}: {
  slug: string;
  device: PublicWorldDevice | null;
  primary: string;
  onClose: () => void;
  /** Re-fly to the selected device — useful when the visitor has
   *  panned the map away from the pin while the drawer is open. */
  onRecenter: () => void;
}) {
  const { data } = useSWR<LiveResponse>(
    device
      ? `/api/public/worlds/${slug}/devices/${device.id}/live`
      : null,
    drawerFetcher,
    { refreshInterval: 15_000 },
  );

  if (!device) return null;
  const Icon = subsystemIcon(device.subsystem);

  return (
    // Positioned above the mobile bottom-nav (3.5rem + safe-area) so
    // its rounded top edge and content aren't clipped behind the nav.
    // Internal `overflow-y-auto` + max-height keeps scrolling inside
    // the drawer — the outer `<main>` is `overflow-hidden` so a tall
    // drawer never pushes the page.
    <aside
      className="absolute left-0 right-0 z-10 mx-auto w-full max-w-[640px] overflow-y-auto rounded-t-2xl border p-5 shadow-2xl backdrop-blur bottom-[calc(3.5rem+env(safe-area-inset-bottom)+0.5rem)] max-h-[calc(100dvh-7.5rem-env(safe-area-inset-bottom))] md:bottom-4 md:left-4 md:right-auto md:w-[380px] md:max-h-[calc(100dvh-8rem)] md:rounded-2xl"
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
          <h2 className="mt-0.5 truncate text-sm font-semibold">
            {device.name}
          </h2>
        </div>
        <button
          type="button"
          onClick={onRecenter}
          aria-label="Fly to this device on the map"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-opacity hover:opacity-90"
          style={{
            backgroundColor: primary,
            color: "var(--w-accent-contrast)",
          }}
        >
          <MapPin size={12} strokeWidth={2.2} aria-hidden />
          Fly to
        </button>
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

      {/* Location strip — road / direction / coords in one line. */}
      <p
        className="mt-1.5 text-[11px]"
        style={{ color: "var(--w-fg-muted)" }}
      >
        {[
          device.primaryRoad,
          device.direction,
          device.crossRoad,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>

      {/* Live detail — same rich rendering the Devices tab uses:
          CCTV/AID video, DMS face, radar telemetry, VSLS speed limit. */}
      <div className="mt-4">
        <DeviceLiveDetail
          subsystem={device.subsystem}
          status={data?.status?.raw ?? null}
          media={data?.media ?? null}
        />
      </div>
    </aside>
  );
}

