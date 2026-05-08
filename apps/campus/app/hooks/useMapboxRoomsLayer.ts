"use client";

import { useEffect, useRef } from "react";
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

const NO_FLOOR_FILTER: unknown[] = [
  "==",
  ["get", "floor"],
  Number.NEGATIVE_INFINITY,
];

function floorFilterFor(activeFloor: number | null | undefined): unknown[] {
  if (activeFloor === null || activeFloor === undefined) return NO_FLOOR_FILTER;
  return ["==", ["get", "floor"], activeFloor];
}

function highlightFilterFor(highlightRoomId: string | null | undefined): unknown[] {
  return [
    "==",
    ["get", "id"],
    highlightRoomId ?? "",
  ];
}

/**
 * Render the given rooms as extruded polygons. All rooms across all floors
 * are drawn, but the layer hides any that don't match `activeFloor` (when
 * set) so the selected floor reads cleanly without stacking noise.
 *
 * Clicking a room fires `onSelect(roomId)` so the parent can open the
 * room card in the right panel.
 *
 * The hook is split into three effects so callbacks (which change ref
 * every parent render) don't cause a teardown — that was the cause of
 * label flicker on every studio interaction.
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

  // Refs so the install effect can read the latest callback / flag
  // without depending on them (which would tear the layer down on
  // every parent render).
  const onSelectRef = useRef(onSelect);
  const clickEnabledRef = useRef(clickEnabled);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);
  useEffect(() => {
    clickEnabledRef.current = clickEnabled;
  }, [clickEnabled]);

  // ─── 1. install ──────────────────────────────────────────────────────────
  // Runs once per map. Idempotent: re-installs gracefully on style.load /
  // styledata (basemap import reload wipes our custom layers).
  useEffect(() => {
    if (!map) return;

    const install = () => {
      try {
        if (!map.getSource(SOURCE_ID)) {
          map.addSource(SOURCE_ID, {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          });
        }
      } catch {
        return;
      }

      const initialFloorFilter = NO_FLOOR_FILTER;
      const initialHighlightFilter = highlightFilterFor(null);

      if (!map.getLayer(LAYER_ID)) {
        map.addLayer({
          id: LAYER_ID,
          type: "fill-extrusion",
          source: SOURCE_ID,
          filter: initialFloorFilter as never,
          paint: {
            "fill-extrusion-color": ["get", "color"],
            "fill-extrusion-base": ["get", "base"],
            "fill-extrusion-height": ["get", "height"],
            "fill-extrusion-opacity": 0.85,
          },
        });
      }
      if (!map.getLayer(LAYER_OUTLINE_ID)) {
        map.addLayer({
          id: LAYER_OUTLINE_ID,
          type: "line",
          source: SOURCE_ID,
          filter: initialFloorFilter as never,
          paint: {
            "line-color": "#ffffff",
            "line-opacity": 0.5,
            "line-width": 1,
          },
        });
      }
      if (!map.getLayer(LAYER_HIGHLIGHT_ID)) {
        map.addLayer({
          id: LAYER_HIGHLIGHT_ID,
          type: "line",
          source: SOURCE_ID,
          filter: initialHighlightFilter as never,
          paint: {
            "line-color": "#ffffff",
            "line-width": 3,
          },
        });
      }
      if (!map.getLayer(LAYER_LABEL_ID)) {
        map.addLayer({
          id: LAYER_LABEL_ID,
          type: "symbol",
          source: SOURCE_ID,
          filter: initialFloorFilter as never,
          layout: {
            "text-field": ["get", "name"] as never,
            "text-size": 12,
            "text-anchor": "center",
            "text-allow-overlap": false,
            "text-ignore-placement": false,
            "text-padding": 2,
          },
          paint: {
            "text-color": "#f5f7fa",
            "text-halo-color": "rgba(15,23,42,0.78)",
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

    // Click + hover handlers. Use refs so changing onSelect / clickEnabled
    // in the parent doesn't re-run this effect.
    const clickHandler = (e: MapMouseEvent) => {
      if (!clickEnabledRef.current) return;
      const feature = map.queryRenderedFeatures(e.point, {
        layers: [LAYER_ID],
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
  }, [map]);

  // ─── 2. data + floor filter ──────────────────────────────────────────────
  // Refresh the source features when rooms change; refresh the floor
  // filter on the three filtered layers when activeFloor changes.
  useEffect(() => {
    if (!map) return;
    const data = buildFeatureCollection(rooms);
    const apply = () => {
      const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      if (src) src.setData(data);
      const filter = floorFilterFor(activeFloor);
      try {
        if (map.getLayer(LAYER_ID)) map.setFilter(LAYER_ID, filter as never);
        if (map.getLayer(LAYER_OUTLINE_ID)) map.setFilter(LAYER_OUTLINE_ID, filter as never);
        if (map.getLayer(LAYER_LABEL_ID)) map.setFilter(LAYER_LABEL_ID, filter as never);
      } catch {
        /* layer may be detached during a style swap */
      }
    };
    apply();
    // The install effect may re-run on styledata before the data effect
    // does — make sure the next idle tick reapplies our filters.
    const onStyleData = () => apply();
    map.on("styledata", onStyleData);
    return () => {
      map.off("styledata", onStyleData);
    };
  }, [map, rooms, activeFloor]);

  // ─── 3. highlight filter ─────────────────────────────────────────────────
  useEffect(() => {
    if (!map) return;
    const apply = () => {
      try {
        if (map.getLayer(LAYER_HIGHLIGHT_ID)) {
          map.setFilter(
            LAYER_HIGHLIGHT_ID,
            highlightFilterFor(highlightRoomId) as never
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
  }, [map, highlightRoomId]);
}
