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
import { FLOOR_HEIGHT_M } from "./useMapboxFloorSlabsLayer";

const SOURCE_ID = "campus-rooms";
const LAYER_ID = "campus-rooms-extrusion";
const LAYER_OUTLINE_ID = "campus-rooms-outline";
const LAYER_HIGHLIGHT_ID = "campus-rooms-highlight";
const LAYER_LABEL_ID = "campus-rooms-label";

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
        // Stack rooms on consistent floor slabs so a tall amphitheatre
        // on floor 1 still sits at FLOOR_HEIGHT_M m, not at 1×6 m.
        // 0.65 sits just above the slab's top face (0.6 thick).
        const base = r.floor * FLOOR_HEIGHT_M + 0.65;
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
    /** When false, click + hover ignored (e.g. during polygon draw). */
    clickEnabled?: boolean;
  } = {}
) {
  const map = useSceneStore((s) => s.mapboxMap as MapboxMap | null);
  const { activeFloor, onSelect, highlightRoomId, clickEnabled = true } = opts;

  useEffect(() => {
    if (!map) return;
    const data = buildFeatureCollection(rooms);

    const install = () => {
      // Don't gate on isStyleLoaded() — Mapbox flips that flag false
      // during config-property changes (e.g. campus label defaults), and
      // we want to recover on the very tick those events fire. addSource
      // / addLayer tolerate being called during a partial style load.
      try {
        if (!map.getSource(SOURCE_ID)) {
          map.addSource(SOURCE_ID, { type: "geojson", data });
        } else {
          (map.getSource(SOURCE_ID) as GeoJSONSource).setData(data);
        }
      } catch {
        // Style may be mid-swap; we'll get another shot on the next
        // styledata / idle event.
        return;
      }

      // Floor filter — rooms are floor-scoped: when a floor is active,
      // only that floor renders; when no floor is active we filter to a
      // sentinel value so nothing renders at all (matches the spec —
      // rooms are an "inside the building, on this floor" detail).
      const NO_FLOOR_FILTER: unknown[] = [
        "==",
        ["get", "floor"],
        Number.NEGATIVE_INFINITY,
      ];
      const floorFilter: unknown[] =
        activeFloor === null || activeFloor === undefined
          ? NO_FLOOR_FILTER
          : ["==", ["get", "floor"], activeFloor];

      if (!map.getLayer(LAYER_ID)) {
        map.addLayer({
          id: LAYER_ID,
          type: "fill-extrusion",
          source: SOURCE_ID,
          filter: floorFilter as never,
          paint: {
            "fill-extrusion-color": ["get", "color"],
            "fill-extrusion-base": ["get", "base"],
            "fill-extrusion-height": ["get", "height"],
            "fill-extrusion-opacity": 0.85,
          },
        });
      } else {
        map.setFilter(LAYER_ID, floorFilter as never);
      }

      if (!map.getLayer(LAYER_OUTLINE_ID)) {
        map.addLayer({
          id: LAYER_OUTLINE_ID,
          type: "line",
          source: SOURCE_ID,
          filter: floorFilter as never,
          paint: {
            "line-color": "#ffffff",
            "line-opacity": 0.5,
            "line-width": 1,
          },
        });
      } else {
        map.setFilter(LAYER_OUTLINE_ID, floorFilter as never);
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

      // Room name labels — only render when a floor is active so we
      // don't paint dozens of names across stacked floors. Mapbox places
      // a polygon's symbol at its centroid. `symbol-z-elevate` lifts the
      // label above the extrusion roof so it never z-fights with the
      // room geometry.
      if (!map.getLayer(LAYER_LABEL_ID)) {
        map.addLayer({
          id: LAYER_LABEL_ID,
          type: "symbol",
          source: SOURCE_ID,
          filter: (floorFilter ?? ["==", ["get", "floor"], Number.NEGATIVE_INFINITY]) as never,
          layout: {
            "text-field": ["get", "name"] as never,
            "text-size": 12,
            "text-anchor": "center",
            "text-allow-overlap": false,
            "text-ignore-placement": false,
            "text-padding": 2,
            "symbol-z-elevate": true,
          },
          paint: {
            "text-color": "#f5f7fa",
            "text-halo-color": "rgba(15,23,42,0.78)",
            "text-halo-width": 1.3,
            "text-halo-blur": 0.6,
          },
        });
      } else if (floorFilter) {
        map.setFilter(LAYER_LABEL_ID, floorFilter as never);
      } else {
        map.setFilter(
          LAYER_LABEL_ID,
          ["==", ["get", "floor"], Number.NEGATIVE_INFINITY] as never
        );
      }
    };

    install();
    // style.load fires once on initial load; styledata fires every time
    // the style is updated (including after setConfigProperty wipes our
    // custom layers); idle is the safety-net catch-all. install() is
    // idempotent.
    const onStyleLoad = () => install();
    const onStyleData = () => install();
    const onIdle = () => install();
    map.on("style.load", onStyleLoad);
    map.on("styledata", onStyleData);
    map.on("idle", onIdle);

    // Click and cursor handlers — only attached once per layer install.
    const clickHandler = (e: MapMouseEvent) => {
      if (!clickEnabled) return;
      const feature = map.queryRenderedFeatures(e.point, {
        layers: [LAYER_ID],
      })[0];
      if (!feature) return;
      const id = (feature.properties?.id ?? feature.id) as string | undefined;
      if (id && onSelect) {
        onSelect(id);
      }
    };
    const hoverEnter = () => {
      if (!clickEnabled) return;
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
      map.off("styledata", onStyleData);
      map.off("idle", onIdle);
      map.off("click", LAYER_ID, clickHandler);
      map.off("mouseenter", LAYER_ID, hoverEnter);
      map.off("mouseleave", LAYER_ID, hoverLeave);
      try {
        if (map.getLayer(LAYER_LABEL_ID)) map.removeLayer(LAYER_LABEL_ID);
        if (map.getLayer(LAYER_HIGHLIGHT_ID)) map.removeLayer(LAYER_HIGHLIGHT_ID);
        if (map.getLayer(LAYER_OUTLINE_ID)) map.removeLayer(LAYER_OUTLINE_ID);
        if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      } catch {
        /* ignore */
      }
    };
  }, [map, rooms, activeFloor, onSelect, highlightRoomId, clickEnabled]);
}
