"use client";

import { useEffect, useRef } from "react";
import type {
  Map as MapboxMap,
  GeoJSONSource,
  MapMouseEvent,
} from "mapbox-gl";
import { useSceneStore } from "@klorad/core";

/**
 * One polygon to render as an extruded indoor volume.
 *
 * Carries everything the generic hook needs:
 *   - stable `id` for click + highlight routing
 *   - `polygon` outer ring as `[lng, lat]` pairs (open or closed — the
 *     hook closes it if needed)
 *   - `level` (floor/layer/tier) for the active-level filter
 *   - `base` + `height` in metres (absolute, not deltas)
 *   - `color` — fill color
 *   - optional `name` for the centered label
 *
 * Verticals tag whatever else they want under `extra` — it ends up on
 * the GeoJSON feature properties so layer expressions or click
 * handlers can read it.
 */
export interface IndoorExtrusionFeature {
  id: string;
  polygon: [number, number][];
  level: number;
  base: number;
  height: number;
  color: string;
  name?: string;
  extra?: Record<string, unknown>;
}

export interface IndoorExtrusionPaint {
  /** Fill opacity for the volume. Default 0.85. */
  fillOpacity?: number;
  /** Color of the polygon outline lines. Default `#ffffff`. */
  outlineColor?: string;
  /** Outline opacity. Default 0.5. */
  outlineOpacity?: number;
  /** Outline width in pixels. Default 1. */
  outlineWidth?: number;
  /** Color of the highlight outline (drawn on top of the regular outline). */
  highlightColor?: string;
  /** Highlight outline width in pixels. Default 3. */
  highlightWidth?: number;
  /** Label text color. Default `#f5f7fa`. */
  labelColor?: string;
  /** Label halo color (for legibility on any background). */
  labelHaloColor?: string;
  /** Label text size in pixels. Default 12. */
  labelSize?: number;
}

export interface UseMapboxIndoorExtrusionOptions {
  /**
   * Layer/source namespace — used to derive the four layer ids
   * (`-source`, `-extrusion`, `-outline`, `-highlight`, `-label`).
   * Pass a vertical-specific prefix like `"campus-rooms"` so two
   * different consumers (rooms + slabs, rooms + heritage layers) can
   * coexist on the same map without clashing.
   */
  namespace: string;
  /** The polygons to render. Order is not significant. */
  features: IndoorExtrusionFeature[];
  /**
   * The active level filter. `null` or `undefined` means "hide all"
   * (parity with the original campus hook — callers that want
   * everything visible should pass an explicit filter via
   * `filterAll`).
   */
  activeLevel?: number | null;
  /**
   * When true, ignore `activeLevel` and show every feature
   * regardless of its `level`. Use for surfaces that want a
   * permanent X-ray of all floors at once.
   */
  showAllLevels?: boolean;
  /** Optional id of a feature to outline with the highlight style. */
  highlightId?: string | null;
  /** Click handler — receives the feature `id`. */
  onSelect?: (id: string) => void;
  /** Disable click + hover (e.g. while a placement is active). */
  clickEnabled?: boolean;
  /** Render the centred name label? Default true. */
  showLabels?: boolean;
  /** Paint overrides — every key has a sensible default. */
  paint?: IndoorExtrusionPaint;
}

function buildFeatureCollection(
  features: IndoorExtrusionFeature[],
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: features
      .filter((f) => f.polygon.length >= 3)
      .map((f) => {
        const ring = [...f.polygon];
        const first = ring[0];
        const last = ring[ring.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
        return {
          type: "Feature",
          id: f.id,
          geometry: { type: "Polygon", coordinates: [ring] },
          properties: {
            ...(f.extra ?? {}),
            id: f.id,
            name: f.name ?? "",
            level: f.level,
            base: f.base,
            height: f.height,
            color: f.color,
          },
        } satisfies GeoJSON.Feature;
      }),
  };
}

const HIDE_ALL_FILTER: unknown[] = [
  "==",
  ["get", "level"],
  Number.NEGATIVE_INFINITY,
];

function levelFilter(
  activeLevel: number | null | undefined,
  showAllLevels: boolean | undefined,
): unknown[] {
  if (showAllLevels) return ["literal", true];
  if (activeLevel === null || activeLevel === undefined) return HIDE_ALL_FILTER;
  return ["==", ["get", "level"], activeLevel];
}

function highlightFilter(highlightId: string | null | undefined): unknown[] {
  return ["==", ["get", "id"], highlightId ?? ""];
}

/**
 * Render a set of indoor polygons as semi-transparent extruded
 * volumes — the "X-ray" indoor view used in every Klorad vertical
 * that maps interior space (campus rooms, heritage stratigraphy,
 * mobility transit layers).
 *
 * What's installed (under `namespace`):
 *   - one GeoJSON source
 *   - one fill-extrusion layer (the volume)
 *   - one line layer (the outline)
 *   - one line layer (the highlight outline, filtered to highlightId)
 *   - one symbol layer (the centered name label, if `showLabels`)
 *
 * The hook is split into three effects so callbacks (which change
 * ref every parent render) don't cause a teardown — that fixed
 * label flicker on the campus side and the same trade-off applies
 * here. Idempotent across style swaps: re-installs on `style.load`,
 * `styledata`, and `idle` because Mapbox occasionally drops custom
 * layers when the basemap reloads its imports.
 */
export function useMapboxIndoorExtrusion(opts: UseMapboxIndoorExtrusionOptions) {
  const map = useSceneStore((s) => s.mapboxMap as MapboxMap | null);
  const {
    namespace,
    features,
    activeLevel,
    showAllLevels,
    highlightId,
    onSelect,
    clickEnabled = true,
    showLabels = true,
    paint,
  } = opts;

  const sourceId = `${namespace}-source`;
  const extrusionId = `${namespace}-extrusion`;
  const outlineId = `${namespace}-outline`;
  const highlightLayerId = `${namespace}-highlight`;
  const labelId = `${namespace}-label`;

  const fillOpacity = paint?.fillOpacity ?? 0.85;
  const outlineColor = paint?.outlineColor ?? "#ffffff";
  const outlineOpacity = paint?.outlineOpacity ?? 0.5;
  const outlineWidth = paint?.outlineWidth ?? 1;
  const highlightColor = paint?.highlightColor ?? "#ffffff";
  const highlightWidth = paint?.highlightWidth ?? 3;
  const labelColor = paint?.labelColor ?? "#f5f7fa";
  const labelHaloColor = paint?.labelHaloColor ?? "rgba(15,23,42,0.78)";
  const labelSize = paint?.labelSize ?? 12;

  // Refs so the install effect can read the latest callback / flag
  // without depending on them.
  const onSelectRef = useRef(onSelect);
  const clickEnabledRef = useRef(clickEnabled);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);
  useEffect(() => {
    clickEnabledRef.current = clickEnabled;
  }, [clickEnabled]);

  // ─── 1. install ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!map) return;

    const install = () => {
      try {
        if (!map.getSource(sourceId)) {
          map.addSource(sourceId, {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          });
        }
      } catch {
        return;
      }

      const initialFilter = HIDE_ALL_FILTER;
      const initialHighlight = highlightFilter(null);

      if (!map.getLayer(extrusionId)) {
        map.addLayer({
          id: extrusionId,
          type: "fill-extrusion",
          source: sourceId,
          filter: initialFilter as never,
          paint: {
            "fill-extrusion-color": ["get", "color"],
            "fill-extrusion-base": ["get", "base"],
            "fill-extrusion-height": ["get", "height"],
            "fill-extrusion-opacity": fillOpacity,
          },
        });
      }
      if (!map.getLayer(outlineId)) {
        map.addLayer({
          id: outlineId,
          type: "line",
          source: sourceId,
          filter: initialFilter as never,
          paint: {
            "line-color": outlineColor,
            "line-opacity": outlineOpacity,
            "line-width": outlineWidth,
          },
        });
      }
      if (!map.getLayer(highlightLayerId)) {
        map.addLayer({
          id: highlightLayerId,
          type: "line",
          source: sourceId,
          filter: initialHighlight as never,
          paint: {
            "line-color": highlightColor,
            "line-width": highlightWidth,
          },
        });
      }
      if (showLabels && !map.getLayer(labelId)) {
        map.addLayer({
          id: labelId,
          type: "symbol",
          source: sourceId,
          filter: initialFilter as never,
          layout: {
            "text-field": ["get", "name"] as never,
            "text-size": labelSize,
            "text-anchor": "center",
            "text-allow-overlap": false,
            "text-ignore-placement": false,
            "text-padding": 2,
          },
          paint: {
            "text-color": labelColor,
            "text-halo-color": labelHaloColor,
            "text-halo-width": 1.3,
            "text-halo-blur": 0.6,
            "text-occlusion-opacity": 0,
          },
        });
      }
    };

    install();
    const onStyleLoad = () => install();
    const onStyleData = () => install();
    const onIdle = () => install();
    map.on("style.load", onStyleLoad);
    map.on("styledata", onStyleData);
    map.on("idle", onIdle);

    // Click + hover handlers — use refs so onSelect / clickEnabled
    // changes don't tear the layer down.
    const clickHandler = (e: MapMouseEvent) => {
      if (!clickEnabledRef.current) return;
      const feature = map.queryRenderedFeatures(e.point, {
        layers: [extrusionId],
      })[0];
      if (!feature) return;
      const id = (feature.properties?.id ?? feature.id) as string | undefined;
      if (id && onSelectRef.current) onSelectRef.current(id);
    };
    const hoverEnter = () => {
      if (!clickEnabledRef.current) return;
      map.getCanvas().style.cursor = "pointer";
    };
    const hoverLeave = () => {
      map.getCanvas().style.cursor = "";
    };
    map.on("click", extrusionId, clickHandler);
    map.on("mouseenter", extrusionId, hoverEnter);
    map.on("mouseleave", extrusionId, hoverLeave);

    return () => {
      map.off("style.load", onStyleLoad);
      map.off("styledata", onStyleData);
      map.off("idle", onIdle);
      map.off("click", extrusionId, clickHandler);
      map.off("mouseenter", extrusionId, hoverEnter);
      map.off("mouseleave", extrusionId, hoverLeave);
      try {
        if (map.getLayer(labelId)) map.removeLayer(labelId);
        if (map.getLayer(highlightLayerId)) map.removeLayer(highlightLayerId);
        if (map.getLayer(outlineId)) map.removeLayer(outlineId);
        if (map.getLayer(extrusionId)) map.removeLayer(extrusionId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch {
        /* ignore */
      }
    };
  }, [
    map,
    sourceId,
    extrusionId,
    outlineId,
    highlightLayerId,
    labelId,
    showLabels,
    fillOpacity,
    outlineColor,
    outlineOpacity,
    outlineWidth,
    highlightColor,
    highlightWidth,
    labelColor,
    labelHaloColor,
    labelSize,
  ]);

  // ─── 2. data + level filter ──────────────────────────────────────────────
  useEffect(() => {
    if (!map) return;
    const data = buildFeatureCollection(features);
    const apply = () => {
      const src = map.getSource(sourceId) as GeoJSONSource | undefined;
      if (src) src.setData(data);
      const filter = levelFilter(activeLevel, showAllLevels);
      try {
        if (map.getLayer(extrusionId))
          map.setFilter(extrusionId, filter as never);
        if (map.getLayer(outlineId)) map.setFilter(outlineId, filter as never);
        if (showLabels && map.getLayer(labelId))
          map.setFilter(labelId, filter as never);
      } catch {
        /* layer may be detached during a style swap */
      }
    };
    apply();
    const onStyleData = () => apply();
    map.on("styledata", onStyleData);
    return () => {
      map.off("styledata", onStyleData);
    };
  }, [
    map,
    features,
    activeLevel,
    showAllLevels,
    sourceId,
    extrusionId,
    outlineId,
    labelId,
    showLabels,
  ]);

  // ─── 3. highlight filter ─────────────────────────────────────────────────
  useEffect(() => {
    if (!map) return;
    const apply = () => {
      try {
        if (map.getLayer(highlightLayerId)) {
          map.setFilter(
            highlightLayerId,
            highlightFilter(highlightId) as never,
          );
        }
      } catch {
        /* ignore */
      }
    };
    apply();
    const onStyleData = () => apply();
    map.on("styledata", onStyleData);
    return () => {
      map.off("styledata", onStyleData);
    };
  }, [map, highlightId, highlightLayerId]);
}
