"use client";

import { useEffect } from "react";
import type {
  Map as MapboxMap,
  GeoJSONSource,
  MapMouseEvent,
} from "mapbox-gl";
import { useSceneStore } from "@klorad/core";
import type { Room } from "@klorad/api";
import { roomColor, roomHeightM } from "@/app/lib/roomTemplates";

const SOURCE_ID = "campus-rooms";
const LAYER_ID = "campus-rooms-extrusion";
const LAYER_OUTLINE_ID = "campus-rooms-outline";
const LAYER_HIGHLIGHT_ID = "campus-rooms-highlight";

function buildFeatureCollection(rooms: Room[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: rooms
      .filter((r) => r.visible !== false)
      .filter((r) => r.polygon.length >= 3)
      .map((r) => {
        const ring = [...r.polygon];
        const first = ring[0];
        const last = ring[ring.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
        const h = roomHeightM(r);
        const base = r.floor * h;
        const height = base + h;
        return {
          type: "Feature",
          id: r.id,
          geometry: { type: "Polygon", coordinates: [ring] },
          properties: {
            id: r.id,
            name: r.name,
            type: r.type,
            floor: r.floor,
            base,
            height,
            color: roomColor(r),
          },
        } satisfies GeoJSON.Feature;
      }),
  };
}

/**
 * Render the given rooms as extruded polygons. All rooms across all floors
 * are drawn, but the layer hides any that don't match `activeFloor` (when
 * set) so the selected floor reads cleanly without stacking noise.
 *
 * Clicking a room fires `onSelect(roomId)` so the parent can open the
 * room card in the right panel.
 */
export function useMapboxRoomsLayer(
  rooms: Room[],
  opts: {
    activeFloor?: number | null;
    onSelect?: (roomId: string) => void;
    highlightRoomId?: string | null;
  } = {}
) {
  const map = useSceneStore((s) => s.mapboxMap as MapboxMap | null);
  const { activeFloor, onSelect, highlightRoomId } = opts;

  useEffect(() => {
    if (!map) return;
    const data = buildFeatureCollection(rooms);

    const install = () => {
      if (!map.isStyleLoaded()) return;

      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, { type: "geojson", data });
      } else {
        (map.getSource(SOURCE_ID) as GeoJSONSource).setData(data);
      }

      // Floor filter — when a floor is active, only that floor renders.
      const floorFilter: unknown[] | null =
        activeFloor === null || activeFloor === undefined
          ? null
          : ["==", ["get", "floor"], activeFloor];

      if (!map.getLayer(LAYER_ID)) {
        map.addLayer({
          id: LAYER_ID,
          type: "fill-extrusion",
          source: SOURCE_ID,
          filter: (floorFilter ?? ["!=", ["get", "floor"], Number.NEGATIVE_INFINITY]) as never,
          paint: {
            "fill-extrusion-color": ["get", "color"],
            "fill-extrusion-base": ["get", "base"],
            "fill-extrusion-height": ["get", "height"],
            "fill-extrusion-opacity": 0.85,
          },
        });
      } else if (floorFilter) {
        map.setFilter(LAYER_ID, floorFilter as never);
      } else {
        map.setFilter(LAYER_ID, null);
      }

      if (!map.getLayer(LAYER_OUTLINE_ID)) {
        map.addLayer({
          id: LAYER_OUTLINE_ID,
          type: "line",
          source: SOURCE_ID,
          filter: (floorFilter ?? ["!=", ["get", "floor"], Number.NEGATIVE_INFINITY]) as never,
          paint: {
            "line-color": "#ffffff",
            "line-opacity": 0.5,
            "line-width": 1,
          },
        });
      } else if (floorFilter) {
        map.setFilter(LAYER_OUTLINE_ID, floorFilter as never);
      } else {
        map.setFilter(LAYER_OUTLINE_ID, null);
      }

      // Highlight ring around the currently-selected room.
      const highlightFilter = highlightRoomId
        ? (["==", ["get", "id"], highlightRoomId] as unknown[])
        : (["==", ["get", "id"], ""] as unknown[]);
      if (!map.getLayer(LAYER_HIGHLIGHT_ID)) {
        map.addLayer({
          id: LAYER_HIGHLIGHT_ID,
          type: "line",
          source: SOURCE_ID,
          filter: highlightFilter as never,
          paint: {
            "line-color": "#ffffff",
            "line-width": 3,
          },
        });
      } else {
        map.setFilter(LAYER_HIGHLIGHT_ID, highlightFilter as never);
      }
    };

    install();
    const onStyleLoad = () => install();
    const onIdle = () => install();
    map.on("style.load", onStyleLoad);
    map.on("idle", onIdle);

    // Click and cursor handlers — only attached once per layer install.
    const clickHandler = (e: MapMouseEvent) => {
      const feature = map.queryRenderedFeatures(e.point, {
        layers: [LAYER_ID],
      })[0];
      if (!feature) return;
      const id = (feature.properties?.id ?? feature.id) as string | undefined;
      if (id && onSelect) {
        e.preventDefault();
        onSelect(id);
      }
    };
    const hoverEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const hoverLeave = () => {
      map.getCanvas().style.cursor = "";
    };
    map.on("click", LAYER_ID, clickHandler);
    map.on("mouseenter", LAYER_ID, hoverEnter);
    map.on("mouseleave", LAYER_ID, hoverLeave);

    return () => {
      map.off("style.load", onStyleLoad);
      map.off("idle", onIdle);
      map.off("click", LAYER_ID, clickHandler);
      map.off("mouseenter", LAYER_ID, hoverEnter);
      map.off("mouseleave", LAYER_ID, hoverLeave);
      try {
        if (map.getLayer(LAYER_HIGHLIGHT_ID)) map.removeLayer(LAYER_HIGHLIGHT_ID);
        if (map.getLayer(LAYER_OUTLINE_ID)) map.removeLayer(LAYER_OUTLINE_ID);
        if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      } catch {
        /* ignore */
      }
    };
  }, [map, rooms, activeFloor, onSelect, highlightRoomId]);
}
