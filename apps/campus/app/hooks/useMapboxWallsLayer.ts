"use client";

import { useEffect } from "react";
import type { GeoJSONSource, Map as MapboxMap } from "mapbox-gl";
import { useSceneStore } from "@klorad/core";
import type { Wall } from "@klorad/api";
import { FLOOR_HEIGHT_M } from "./useMapboxFloorSlabsLayer";

const SOURCE_ID = "campus-walls";
const LAYER_ID = "campus-walls-extrusion";

/** Wall height, metres — a touch under the floor height. */
const WALL_HEIGHT_M = 2.6;
/** Lift walls onto the floor slab — matches the room base offset. */
const SLAB_OFFSET_M = 0.65;

/**
 * Turn a wall segment into a thin rectangle ring by offsetting each
 * end perpendicular to the segment by half the wall thickness. The
 * offset is computed in metres, then converted back to lng/lat.
 */
function segmentRect(
  a: [number, number],
  b: [number, number],
  thickness: number,
): Array<[number, number]> {
  const lat = (a[1] + b[1]) / 2;
  const mPerLat = 111320;
  const mPerLng = 111320 * Math.cos((lat * Math.PI) / 180) || 1;
  const ex = (b[0] - a[0]) * mPerLng;
  const ey = (b[1] - a[1]) * mPerLat;
  const len = Math.hypot(ex, ey) || 1;
  // Perpendicular, scaled to half-thickness (metres).
  const hx = (-ey / len) * (thickness / 2);
  const hy = (ex / len) * (thickness / 2);
  const dLng = hx / mPerLng;
  const dLat = hy / mPerLat;
  return [
    [a[0] + dLng, a[1] + dLat],
    [b[0] + dLng, b[1] + dLat],
    [b[0] - dLng, b[1] - dLat],
    [a[0] - dLng, a[1] - dLat],
    [a[0] + dLng, a[1] + dLat],
  ];
}

/**
 * Renders walls as 3D extruded volumes — a `fill-extrusion` layer,
 * the same technique buildings and rooms use, so a wall reads as a
 * wall (thickness + height) rather than a flat line on the ground.
 *
 * Each wall segment is buffered to its thickness and extruded from
 * the floor's elevation; pass the floor index the walls belong to.
 */
export function useMapboxWallsLayer(walls: Wall[], floor: number) {
  const map = useSceneStore((s) => s.mapboxMap as MapboxMap | null);

  useEffect(() => {
    if (!map) return;

    const base = floor * FLOOR_HEIGHT_M + SLAB_OFFSET_M;
    const features: GeoJSON.Feature[] = [];
    for (const wall of walls) {
      const thickness = wall.thickness ?? 0.15;
      for (let i = 0; i + 1 < wall.points.length; i++) {
        features.push({
          type: "Feature",
          properties: { base, height: base + WALL_HEIGHT_M },
          geometry: {
            type: "Polygon",
            coordinates: [segmentRect(wall.points[i], wall.points[i + 1], thickness)],
          },
        });
      }
    }
    const data: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features,
    };

    const install = () => {
      if (!map.isStyleLoaded()) return;
      const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      if (source) {
        source.setData(data);
        return;
      }
      map.addSource(SOURCE_ID, { type: "geojson", data });
      map.addLayer({
        id: LAYER_ID,
        type: "fill-extrusion",
        source: SOURCE_ID,
        paint: {
          "fill-extrusion-color": "#3f4754",
          "fill-extrusion-base": ["get", "base"],
          "fill-extrusion-height": ["get", "height"],
          "fill-extrusion-opacity": 0.95,
        },
      });
    };

    install();
    const onStyle = () => install();
    map.on("style.load", onStyle);
    map.on("idle", onStyle);

    return () => {
      map.off("style.load", onStyle);
      map.off("idle", onStyle);
      try {
        if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      } catch {
        /* style already torn down */
      }
    };
  }, [map, walls, floor]);
}
