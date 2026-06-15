/**
 * Shared map environment settings — style + light preset + terrain +
 * 3D buildings — applied to both the operator console and the public
 * world viewer. Centralised so the two surfaces stay in lockstep when
 * a style ships new config keys or a fourth preset lands.
 *
 * Mapbox Standard + Standard Satellite expose dynamic `basemap`
 * config properties (`lightPreset`, `show3dObjects`); classic styles
 * like `dark-v11` don't, so the panel UI grays those controls out
 * when the active style doesn't support them. Terrain is independent
 * of style — every style can drape the `mapbox-terrain-dem-v1`
 * source.
 */
import type { Map as MapboxMap } from "mapbox-gl";

/** Stable keys for the style picker. Keep narrow — adding a new
 *  entry is a deliberate design + cost decision per Mapbox tile
 *  pricing. */
export type MapStyleKey = "standard" | "satellite" | "minimal";

export type LightPreset = "day" | "dawn" | "dusk" | "night";

export interface MapStyleDef {
  label: string;
  url: string;
  description: string;
  /** Whether the style exposes the dynamic Standard `basemap` config
   *  surface. False for classic styles like dark-v11. */
  supportsLightPreset: boolean;
  /** Whether `show3dObjects` toggles on this style. False outside
   *  Standard / Standard Satellite. */
  supports3dObjects: boolean;
}

export const MAP_STYLES: Record<MapStyleKey, MapStyleDef> = {
  standard: {
    label: "Standard",
    url: "mapbox://styles/mapbox/standard",
    description: "Civic, full detail.",
    supportsLightPreset: true,
    supports3dObjects: true,
  },
  satellite: {
    label: "Satellite",
    url: "mapbox://styles/mapbox/standard-satellite",
    description: "Aerial imagery.",
    supportsLightPreset: true,
    supports3dObjects: true,
  },
  minimal: {
    label: "Minimal",
    url: "mapbox://styles/mapbox/dark-v11",
    description: "Dark, low-contrast.",
    supportsLightPreset: false,
    supports3dObjects: false,
  },
};

export const MAP_STYLE_LIST: Array<{ key: MapStyleKey; def: MapStyleDef }> = (
  Object.entries(MAP_STYLES) as Array<[MapStyleKey, MapStyleDef]>
).map(([key, def]) => ({ key, def }));

export interface MapEnvSettings {
  mapStyle: MapStyleKey;
  lightPreset: LightPreset;
  showTerrain: boolean;
  show3dBuildings: boolean;
  /** Phase 3 — render devices as 3D meshes through the Three.js
   *  custom layer. When off, the 2D symbol layer carries on. */
  show3dDevices: boolean;
}

const TERRAIN_SOURCE_ID = "mapbox-dem";

/**
 * Project current settings onto the map. Safe to call any time after
 * `style.load`; every operation is idempotent. Setting `lightPreset` /
 * `show3dObjects` on a style that doesn't define them throws
 * internally, so we swallow the throw rather than gate on style key
 * (cheaper at runtime and resilient to Mapbox renaming).
 */
export function applyMapEnvSettings(
  map: MapboxMap,
  settings: MapEnvSettings,
): void {
  const style = MAP_STYLES[settings.mapStyle];

  if (style.supportsLightPreset) {
    try {
      map.setConfigProperty("basemap", "lightPreset", settings.lightPreset);
    } catch {
      /* style not Standard-flavoured — ignore */
    }
  }
  if (style.supports3dObjects) {
    try {
      map.setConfigProperty(
        "basemap",
        "show3dObjects",
        settings.show3dBuildings,
      );
    } catch {
      /* same */
    }
  }

  if (settings.showTerrain) {
    if (!map.getSource(TERRAIN_SOURCE_ID)) {
      map.addSource(TERRAIN_SOURCE_ID, {
        type: "raster-dem",
        url: "mapbox://mapbox.mapbox-terrain-dem-v1",
        tileSize: 512,
        maxzoom: 14,
      });
    }
    map.setTerrain({ source: TERRAIN_SOURCE_ID, exaggeration: 1.5 });
  } else {
    map.setTerrain(null);
  }
}

/** Hydrate settings from localStorage, falling back to defaults. */
export function loadMapEnvSettings(
  storageKey: string,
  defaults: MapEnvSettings,
): MapEnvSettings {
  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<MapEnvSettings>;
    // Reject unknown style keys — if a saved style was removed from
    // MAP_STYLES, snap back to the default rather than crash on init.
    if (parsed.mapStyle && !(parsed.mapStyle in MAP_STYLES)) {
      delete parsed.mapStyle;
    }
    // `show3dDevices` is a Phase-3 addition — older persisted blobs
    // won't have it. Coerce undefined → false so existing operators
    // don't get 3D forced on without opting in.
    if (typeof parsed.show3dDevices !== "boolean") {
      parsed.show3dDevices = defaults.show3dDevices ?? false;
    }
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

export function saveMapEnvSettings(
  storageKey: string,
  settings: MapEnvSettings,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(settings));
  } catch {
    /* quota exceeded or storage disabled */
  }
}

/**
 * Decide if the *basemap* (what's painted under the overlays) reads
 * as dark or bright. Used to flip floating overlays (legend, chips,
 * popovers) between a glass-light and a glass-dark palette so the
 * dashboard chrome doesn't go invisible when the operator switches
 * from a day preset to a night preset on the same Standard map.
 *
 * Minimal (dark-v11) is hard-coded dark — it ignores `lightPreset`.
 */
export function isBasemapDark(
  preset: LightPreset,
  styleKey: MapStyleKey,
): boolean {
  if (!MAP_STYLES[styleKey].supportsLightPreset) return true;
  return preset === "dusk" || preset === "night";
}

export interface MapOverlayPalette {
  bg: string;
  border: string;
  borderStrong: string;
  fg: string;
  fgSoft: string;
  fgMuted: string;
  accentBadge: string;
  accentBadgeFg: string;
}

const LIGHT_OVERLAY: MapOverlayPalette = {
  bg: "rgba(255, 255, 255, 0.92)",
  border: "rgba(15, 23, 42, 0.16)",
  borderStrong: "rgba(15, 23, 42, 0.32)",
  fg: "rgba(15, 23, 42, 0.95)",
  fgSoft: "rgba(15, 23, 42, 0.7)",
  fgMuted: "rgba(15, 23, 42, 0.5)",
  accentBadge: "rgba(15, 23, 42, 0.06)",
  accentBadgeFg: "rgba(15, 23, 42, 0.95)",
};

const DARK_OVERLAY: MapOverlayPalette = {
  bg: "rgba(11, 18, 32, 0.92)",
  border: "rgba(255, 255, 255, 0.16)",
  borderStrong: "rgba(255, 255, 255, 0.34)",
  fg: "rgba(245, 247, 250, 0.96)",
  fgSoft: "rgba(245, 247, 250, 0.74)",
  fgMuted: "rgba(245, 247, 250, 0.55)",
  accentBadge: "rgba(245, 247, 250, 0.08)",
  accentBadgeFg: "rgba(245, 247, 250, 0.96)",
};

/**
 * Derive the overlay palette for the current map settings. Returns a
 * record ready to spread onto a `style` block (the keys are CSS
 * custom-property names, prefixed `--ov-*`).
 */
export function deriveMapOverlayCssVars(
  settings: Pick<MapEnvSettings, "lightPreset" | "mapStyle">,
): Record<string, string> {
  const palette = isBasemapDark(settings.lightPreset, settings.mapStyle)
    ? DARK_OVERLAY
    : LIGHT_OVERLAY;
  return {
    "--ov-bg": palette.bg,
    "--ov-border": palette.border,
    "--ov-border-strong": palette.borderStrong,
    "--ov-fg": palette.fg,
    "--ov-fg-soft": palette.fgSoft,
    "--ov-fg-muted": palette.fgMuted,
    "--ov-accent-badge": palette.accentBadge,
    "--ov-accent-badge-fg": palette.accentBadgeFg,
  };
}
