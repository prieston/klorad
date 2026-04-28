"use client";

import { useEffect } from "react";
import { useSceneStore } from "@klorad/core";

interface MapboxLayer {
  id: string;
  type: string;
}

interface MapboxLike {
  setConfigProperty?: (importId: string, k: string, v: unknown) => void;
  getStyle?: () => { layers?: MapboxLayer[] } | undefined;
  setLayoutProperty?: (id: string, name: string, value: unknown) => void;
  isStyleLoaded?: () => boolean;
  on?: (event: string, handler: () => void) => void;
  off?: (event: string, handler: () => void) => void;
}

/**
 * Should this Mapbox style layer id be force-hidden on campus? Mapbox
 * Standard's building / building-number / landmark / place / road /
 * transit symbol layers don't all have a public toggle, but they share
 * predictable id patterns. We hide every basemap symbol layer except
 * our own `campus-` prefixed ones.
 */
function isBuiltinLabelLayer(layerId: string): boolean {
  if (layerId.startsWith("campus-")) return false;
  return (
    /label/i.test(layerId) ||
    /building-number/i.test(layerId) ||
    /landmark/i.test(layerId)
  );
}

function hideBuiltinLabels(map: MapboxLike) {
  const style = map.getStyle?.();
  const layers = style?.layers ?? [];
  for (const layer of layers) {
    if (layer.type !== "symbol") continue;
    if (!isBuiltinLabelLayer(layer.id)) continue;
    try {
      map.setLayoutProperty?.(layer.id, "visibility", "none");
    } catch {
      /* layer may live in a basemap import — setLayoutProperty noops */
    }
  }
}

/**
 * Mapbox Standard config keys that we force OFF by default on campus.
 * Each one fades in/out across zoom-stop thresholds in the stock style;
 * on a campus map (where the focus is the buildings + our POIs) the
 * zoom transitions read as flickering.
 *
 * - Label keys: place / POI / road / transit names from the basemap.
 * - 3D landmarks: featured Mapbox 3D models (Eiffel Tower etc.).
 * - 3D trees: per-zoom tree pops.
 * - Pedestrian roads: overlay road network that competes with our POIs.
 *
 * We do NOT touch `show3dBuildings` — those are usually wanted, and the
 * user can flip everything back on per-map from the Environment tab.
 */
const FORCE_OFF_KEYS = [
  "showPlaceLabels",
  "showPointOfInterestLabels",
  "showRoadLabels",
  "showTransitLabels",
  "show3dLandmarks",
  "show3dTrees",
  "showPedestrianRoads",
] as const;

/**
 * Patch raw sceneData (as returned from the API) so the Mapbox Standard
 * label toggles default to OFF on campus maps unless the saved scene
 * already chose explicitly. Apply this BEFORE handing the scene to
 * `api.load(...)` so the store ends up with the right values from the
 * very first render — Mapbox Standard's labels otherwise fade in/out on
 * zoom-stop transitions and read as flicker.
 */
export function withCampusLabelDefaults(
  sceneData: unknown
): Record<string, unknown> {
  const scene = (sceneData ?? {}) as Record<string, unknown>;
  const mapbox = (scene.mapboxScene ?? {}) as Record<string, unknown>;
  const sb = (mapbox.standardBasemap ?? {}) as Record<string, unknown>;
  const patchedSb: Record<string, unknown> = { ...sb };
  for (const key of FORCE_OFF_KEYS) {
    if (sb[key] === undefined) patchedSb[key] = false;
  }
  return {
    ...scene,
    mapboxScene: { ...mapbox, standardBasemap: patchedSb },
  };
}

/**
 * Companion hook — pushes the same defaults to the *live* map, in case
 * the scene was already loaded with labels on (e.g. legacy maps that
 * were saved before this default landed). Runs once after the scene is
 * ready; respects subsequent user toggles via the Environment tab
 * because those write through `setMapboxSceneData` to the store.
 */
export function useCampusLabelDefaults(sceneReady: boolean) {
  useEffect(() => {
    if (!sceneReady) return;
    const state = useSceneStore.getState();
    const map = state.mapboxMap as MapboxLike | null;
    if (!map?.setConfigProperty) return;

    const sb = state.mapboxSceneData.standardBasemap ?? {};
    const importId = sb.importId ?? "basemap";

    // Force the labels off when the loaded scene didn't explicitly set
    // them. We can't read "was it in the saved scene?" from the merged
    // store, so we treat any value still equal to the core defaults
    // (`true`) as unset and override.
    const next: Record<string, boolean> = {};
    for (const key of FORCE_OFF_KEYS) {
      const current = (sb as Record<string, unknown>)[key];
      if (current !== false) next[key] = false;
    }
    if (Object.keys(next).length === 0) return;

    state.setMapboxSceneData({ standardBasemap: { ...sb, ...next } });
    for (const [k, v] of Object.entries(next)) {
      try {
        map.setConfigProperty!(importId, k, v);
      } catch {
        /* classic styles ignore basemap config */
      }
    }

    // Belt-and-braces: hide any built-in symbol layer that survived the
    // standardBasemap config (Mapbox doesn't expose a flag for the
    // building-name / building-number / landmark labels but they share
    // predictable ids). Re-run on every style.load because changing
    // the base style resets layer visibility.
    const apply = () => {
      if (map.isStyleLoaded?.()) hideBuiltinLabels(map);
    };
    apply();
    map.on?.("style.load", apply);
    map.on?.("idle", apply);
    return () => {
      map.off?.("style.load", apply);
      map.off?.("idle", apply);
    };
  }, [sceneReady]);
}
