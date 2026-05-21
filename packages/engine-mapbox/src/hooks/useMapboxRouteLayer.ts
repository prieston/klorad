"use client";

import { useEffect, useRef } from "react";
import type { Map as MapboxMap, GeoJSONSource } from "mapbox-gl";
import { useSceneStore } from "@klorad/core";

/**
 * One indoor segment of a stitched route. The route may cross
 * floors, so it's modelled as an array of segments — each segment
 * sits on a single level and the renderer joins them visually
 * (vertical-transit edges connect adjacent segments).
 */
export interface IndoorRouteSegment {
  coordinates: [number, number][];
  level: number;
}

export interface RouteLayerPaint {
  /** Color of the outdoor polyline. Defaults to the brand accent. */
  outdoorColor?: string;
  /** Color of the indoor route. Defaults to a lighter accent tint. */
  indoorColor?: string;
  /** Line width in px. Defaults to 6. */
  width?: number;
  /** Dasharray for the indoor segment. Defaults to a 1/2 ratio. */
  indoorDasharray?: [number, number];
  /** Color of the start/end markers. Defaults to the brand accent. */
  markerColor?: string;
  /** Marker radius in px. Defaults to 7. */
  markerRadius?: number;
}

export interface UseMapboxRouteLayerOptions {
  /**
   * Namespace for source + layer ids. Pass a vertical-specific
   * prefix like `"campus-wayfinding"` so two route renderers (e.g.
   * a preview + a confirmed selection) can coexist.
   */
  namespace: string;
  /** Outdoor polyline (Mapbox Directions output, or fallback line). */
  outdoor?: [number, number][] | null;
  /** Indoor segments, one per floor traversed. */
  indoor?: IndoorRouteSegment[] | null;
  /** Optional start marker. */
  start?: [number, number] | null;
  /** Optional end marker. */
  end?: [number, number] | null;
  paint?: RouteLayerPaint;
}

interface FeatureCollections {
  outdoor: GeoJSON.FeatureCollection;
  indoor: GeoJSON.FeatureCollection;
  markers: GeoJSON.FeatureCollection;
}

function buildCollections(
  outdoor: [number, number][] | null | undefined,
  indoor: IndoorRouteSegment[] | null | undefined,
  start: [number, number] | null | undefined,
  end: [number, number] | null | undefined,
): FeatureCollections {
  const outdoorFC: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: outdoor && outdoor.length >= 2
      ? [
          {
            type: "Feature",
            geometry: { type: "LineString", coordinates: outdoor },
            properties: {},
          },
        ]
      : [],
  };

  const indoorFC: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: (indoor ?? [])
      .filter((seg) => seg.coordinates.length >= 2)
      .map((seg) => ({
        type: "Feature",
        geometry: { type: "LineString", coordinates: seg.coordinates },
        properties: { level: seg.level },
      })),
  };

  const markerFeatures: GeoJSON.Feature[] = [];
  if (start) {
    markerFeatures.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: start },
      properties: { kind: "start" },
    });
  }
  if (end) {
    markerFeatures.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: end },
      properties: { kind: "end" },
    });
  }
  const markersFC: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: markerFeatures,
  };

  return { outdoor: outdoorFC, indoor: indoorFC, markers: markersFC };
}

/**
 * Render a stitched wayfinding route onto the map — outdoor segment
 * as a solid line, indoor segments as dashed lines, plus start/end
 * markers. The hook installs once per namespace and updates the
 * three feature collections in place; idempotent across style swaps
 * (re-installs on `style.load`, `styledata`, `idle`).
 *
 * Verticals reuse the same primitive: campus walking, mobility
 * transit, heritage trails. The `namespace` keeps multiple instances
 * isolated on the same map.
 */
export function useMapboxRouteLayer(opts: UseMapboxRouteLayerOptions) {
  const map = useSceneStore((s) => s.mapboxMap as MapboxMap | null);
  const { namespace, outdoor, indoor, start, end, paint } = opts;

  const outdoorSourceId = `${namespace}-outdoor-source`;
  const indoorSourceId = `${namespace}-indoor-source`;
  const markerSourceId = `${namespace}-markers-source`;
  const outdoorLineId = `${namespace}-outdoor-line`;
  const outdoorCasingId = `${namespace}-outdoor-casing`;
  const indoorLineId = `${namespace}-indoor-line`;
  const markerLayerId = `${namespace}-markers`;

  const outdoorColor = paint?.outdoorColor ?? "#158ca3";
  const indoorColor = paint?.indoorColor ?? "#5dbcd0";
  const width = paint?.width ?? 6;
  const indoorDasharray = paint?.indoorDasharray ?? [1, 2];
  const markerColor = paint?.markerColor ?? "#158ca3";
  const markerRadius = paint?.markerRadius ?? 7;

  // Refs for the install effect to read the latest paint config
  // without re-installing on every paint tweak.
  const paintRef = useRef({
    outdoorColor,
    indoorColor,
    width,
    indoorDasharray,
    markerColor,
    markerRadius,
  });
  paintRef.current = {
    outdoorColor,
    indoorColor,
    width,
    indoorDasharray,
    markerColor,
    markerRadius,
  };

  // ─── install ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!map) return;

    const install = () => {
      const p = paintRef.current;
      try {
        if (!map.getSource(outdoorSourceId)) {
          map.addSource(outdoorSourceId, {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          });
        }
        if (!map.getSource(indoorSourceId)) {
          map.addSource(indoorSourceId, {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          });
        }
        if (!map.getSource(markerSourceId)) {
          map.addSource(markerSourceId, {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          });
        }
      } catch {
        return;
      }

      // Casing → outdoor → indoor (dashed) → markers, in that paint
      // order so the route reads cleanly even where it crosses
      // labels and basemap chrome.
      if (!map.getLayer(outdoorCasingId)) {
        map.addLayer({
          id: outdoorCasingId,
          type: "line",
          source: outdoorSourceId,
          paint: {
            "line-color": "rgba(255,255,255,0.9)",
            "line-width": p.width + 3,
            "line-opacity": 0.85,
          },
          layout: { "line-cap": "round", "line-join": "round" },
        });
      }
      if (!map.getLayer(outdoorLineId)) {
        map.addLayer({
          id: outdoorLineId,
          type: "line",
          source: outdoorSourceId,
          paint: {
            "line-color": p.outdoorColor,
            "line-width": p.width,
          },
          layout: { "line-cap": "round", "line-join": "round" },
        });
      }
      if (!map.getLayer(indoorLineId)) {
        map.addLayer({
          id: indoorLineId,
          type: "line",
          source: indoorSourceId,
          paint: {
            "line-color": p.indoorColor,
            "line-width": p.width,
            "line-dasharray": p.indoorDasharray,
          },
          layout: { "line-cap": "round", "line-join": "round" },
        });
      }
      if (!map.getLayer(markerLayerId)) {
        map.addLayer({
          id: markerLayerId,
          type: "circle",
          source: markerSourceId,
          paint: {
            "circle-color": p.markerColor,
            "circle-radius": p.markerRadius,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 3,
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

    return () => {
      map.off("style.load", onStyleLoad);
      map.off("styledata", onStyleData);
      map.off("idle", onIdle);
      try {
        for (const id of [
          markerLayerId,
          indoorLineId,
          outdoorLineId,
          outdoorCasingId,
        ]) {
          if (map.getLayer(id)) map.removeLayer(id);
        }
        for (const id of [outdoorSourceId, indoorSourceId, markerSourceId]) {
          if (map.getSource(id)) map.removeSource(id);
        }
      } catch {
        /* ignore */
      }
    };
  }, [
    map,
    outdoorSourceId,
    indoorSourceId,
    markerSourceId,
    outdoorCasingId,
    outdoorLineId,
    indoorLineId,
    markerLayerId,
  ]);

  // ─── data ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!map) return;
    const fc = buildCollections(outdoor, indoor, start, end);
    const apply = () => {
      const o = map.getSource(outdoorSourceId) as GeoJSONSource | undefined;
      const i = map.getSource(indoorSourceId) as GeoJSONSource | undefined;
      const m = map.getSource(markerSourceId) as GeoJSONSource | undefined;
      if (o) o.setData(fc.outdoor);
      if (i) i.setData(fc.indoor);
      if (m) m.setData(fc.markers);
    };
    apply();
    const onStyleData = () => apply();
    map.on("styledata", onStyleData);
    return () => {
      map.off("styledata", onStyleData);
    };
  }, [
    map,
    outdoor,
    indoor,
    start,
    end,
    outdoorSourceId,
    indoorSourceId,
    markerSourceId,
  ]);
}
