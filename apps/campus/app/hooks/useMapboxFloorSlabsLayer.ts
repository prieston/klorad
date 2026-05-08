"use client";

import { useEffect, useRef } from "react";
import type {
  Map as MapboxMap,
  GeoJSONSource,
  MapMouseEvent,
} from "mapbox-gl";
import { useSceneStore } from "@klorad/core";
import type { FloorPlan, POI, Room } from "@klorad/api";

/** Vertical distance between floor slabs, in metres. */
export const FLOOR_HEIGHT_M = 3;

const SOURCE_ID = "campus-floor-slabs";
const FILL_LAYER_ID = "campus-floor-slabs-fill";
const OUTLINE_LAYER_ID = "campus-floor-slabs-outline";

interface SlabFeature {
  buildingPoiId: string;
  buildingName: string;
  polygon: [number, number][];
  floor: number;
  /** Floor plan id when one exists for this floor (so click can route to it). */
  planId: string | null;
}

function extractSlabs(
  pois: POI[],
  plans: FloorPlan[],
  rooms: Room[]
): SlabFeature[] {
  const out: SlabFeature[] = [];
  for (const p of pois) {
    const polygon = p.linkedBuilding?.polygon;
    if (!polygon || polygon.length < 3) continue;
    // Floors come from existing plans + rooms; plus floor 0 if there
    // are none yet (so a freshly-drawn building shows a ground slab).
    const floorIdxs = new Set<number>();
    for (const pl of plans) {
      if (pl.buildingId === p.id) floorIdxs.add(pl.floor ?? 0);
    }
    for (const r of rooms) {
      if (r.buildingId === p.id) floorIdxs.add(r.floor);
    }
    if (floorIdxs.size === 0) floorIdxs.add(0);
    for (const floor of floorIdxs) {
      const plan = plans.find(
        (pl) => pl.buildingId === p.id && (pl.floor ?? 0) === floor
      );
      out.push({
        buildingPoiId: p.id,
        buildingName: p.name,
        polygon,
        floor,
        planId: plan?.id ?? null,
      });
    }
  }
  return out;
}

function buildFeatureCollection(slabs: SlabFeature[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: slabs.map((s, idx) => {
      const ring = [...s.polygon];
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
      const base = s.floor * FLOOR_HEIGHT_M;
      return {
        type: "Feature",
        // Numeric ids are required for hit-testing; encode building+floor.
        id: idx,
        geometry: { type: "Polygon", coordinates: [ring] },
        properties: {
          buildingPoiId: s.buildingPoiId,
          floor: s.floor,
          base,
          height: base + 0.6, // slab thick enough to read from a pitched camera
          planId: s.planId ?? "",
        },
      } satisfies GeoJSON.Feature;
    }),
  };
}

interface Options {
  /** When set, the matching slab is highlighted as active. */
  activePlanId?: string | null;
  /** When set, slabs for any other building fade out. */
  selectedBuildingPoiId?: string | null;
  /**
   * Click handler — receives the building id and floor number. The
   * caller is responsible for setting the active plan / floor and
   * flying the camera.
   */
  onSelect?: (buildingPoiId: string, floor: number, planId: string | null) => void;
  /** When false, click ignored (e.g. during polygon draw). */
  clickEnabled?: boolean;
}

/**
 * Render a thin 3D slab for every (building, floor) pair derived from
 * existing FloorPlans + Rooms. Slabs sit at `floor * FLOOR_HEIGHT_M`
 * elevation, so stacking is visible from a pitched camera. The active
 * floor is highlighted; non-selected buildings fade so the focus stays
 * on the building you're working on.
 */
export function useMapboxFloorSlabsLayer(
  pois: POI[],
  plans: FloorPlan[],
  rooms: Room[],
  opts: Options = {}
) {
  const map = useSceneStore((s) => s.mapboxMap as MapboxMap | null);
  const { activePlanId, selectedBuildingPoiId, onSelect, clickEnabled = true } = opts;
  const onSelectRef = useRef(onSelect);
  const clickEnabledRef = useRef(clickEnabled);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);
  useEffect(() => {
    clickEnabledRef.current = clickEnabled;
  }, [clickEnabled]);

  // Mount layer once per map.
  useEffect(() => {
    if (!map) return;

    const install = () => {
      if (!map.isStyleLoaded()) return;
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
      }
      if (!map.getLayer(FILL_LAYER_ID)) {
        map.addLayer({
          id: FILL_LAYER_ID,
          type: "fill-extrusion",
          source: SOURCE_ID,
          paint: {
            "fill-extrusion-color": "#cbd5e1",
            "fill-extrusion-base": ["get", "base"],
            "fill-extrusion-height": ["get", "height"],
            "fill-extrusion-opacity": 0.55,
          },
        });
      }
      if (!map.getLayer(OUTLINE_LAYER_ID)) {
        map.addLayer({
          id: OUTLINE_LAYER_ID,
          type: "line",
          source: SOURCE_ID,
          paint: {
            "line-color": "#6B9CD8",
            "line-opacity": 0.95,
            "line-width": 2,
          },
        });
      }
      // Re-promote the room layers above the slabs so rooms sitting on
      // the active floor stay visible (avoids z-fight with the slab
      // surface and shell walls). Only do this when we haven't yet
      // promoted since the last style reload — `moveLayer` invalidates
      // Mapbox's layer order and forces label collision to recompute,
      // which on every `idle` event makes labels visibly flicker.
      if (!promoted) {
        let movedAll = true;
        for (const id of [
          "campus-rooms-extrusion",
          "campus-rooms-outline",
          "campus-rooms-highlight",
          "campus-rooms-label",
        ]) {
          try {
            if (map.getLayer(id)) map.moveLayer(id);
            else movedAll = false;
          } catch {
            movedAll = false;
          }
        }
        if (movedAll) promoted = true;
      }
    };

    let promoted = false;
    install();
    // Style reloads wipe our layers — reset the promotion flag so the
    // next install() re-orders the room layers on top.
    const onStyleLoad = () => {
      promoted = false;
      install();
    };
    const onStyleData = () => {
      promoted = false;
      install();
    };
    const onIdle = () => install();
    map.on("style.load", onStyleLoad);
    map.on("idle", onIdle);
    map.on("styledata", onStyleData);

    const clickHandler = (e: MapMouseEvent) => {
      if (!clickEnabledRef.current) return;
      const f = map.queryRenderedFeatures(e.point, { layers: [FILL_LAYER_ID] })[0];
      if (!f) return;
      const buildingPoiId = f.properties?.buildingPoiId as string | undefined;
      const floor = f.properties?.floor as number | undefined;
      const planId = (f.properties?.planId as string | undefined) || null;
      if (buildingPoiId !== undefined && floor !== undefined && onSelectRef.current) {

        onSelectRef.current(buildingPoiId, floor, planId);
      }
    };
    map.on("click", FILL_LAYER_ID, clickHandler);

    return () => {
      map.off("style.load", onStyleLoad);
      map.off("idle", onIdle);
      map.off("styledata", onStyleData);
      map.off("click", FILL_LAYER_ID, clickHandler);
      try {
        if (map.getLayer(OUTLINE_LAYER_ID)) map.removeLayer(OUTLINE_LAYER_ID);
        if (map.getLayer(FILL_LAYER_ID)) map.removeLayer(FILL_LAYER_ID);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      } catch {
        /* ignore */
      }
    };
  }, [map]);

  // Sync source data whenever the inputs change.
  useEffect(() => {
    if (!map) return;
    const apply = () => {
      if (!map.isStyleLoaded()) return;
      const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      if (!src) return;
      src.setData(buildFeatureCollection(extractSlabs(pois, plans, rooms)));
    };
    apply();
    const onIdle = () => apply();
    map.on("idle", onIdle);
    return () => {
      map.off("idle", onIdle);
    };
  }, [map, pois, plans, rooms]);

  // Recolour + visibility based on active selection. Per the spec, the
  // slab layer is idle-hidden — only renders when a floor is active.
  // Mapbox's `fill-extrusion-opacity` does NOT accept data-driven
  // expressions (and the color's alpha channel is dropped on
  // fill-extrusion at render time), so we rely on the color expression
  // alone to differentiate the active slab from the rest. Filter (the
  // selected building's slabs) drives "which buildings show" instead.
  useEffect(() => {
    if (!map) return;
    if (!map.getLayer(FILL_LAYER_ID)) return;
    const visible = activePlanId ? "visible" : "none";
    map.setLayoutProperty(FILL_LAYER_ID, "visibility", visible);
    map.setLayoutProperty(OUTLINE_LAYER_ID, "visibility", visible);
    if (!activePlanId) return;

    // Restrict to the selected building when one's set; this is how we
    // "fade" other buildings — by hiding their slabs entirely.
    const filter = selectedBuildingPoiId
      ? (["==", ["get", "buildingPoiId"], selectedBuildingPoiId] as unknown[])
      : null;
    map.setFilter(FILL_LAYER_ID, filter as never);
    map.setFilter(OUTLINE_LAYER_ID, filter as never);

    // Active slab gets the Klorad primary tint at full opacity so it
    // reads as the floor surface; below floors stay neutral grey.
    map.setPaintProperty(FILL_LAYER_ID, "fill-extrusion-color", [
      "case",
      ["==", ["get", "planId"], activePlanId],
      "#6B9CD8",
      "#cbd5e1",
    ]);
    map.setPaintProperty(FILL_LAYER_ID, "fill-extrusion-opacity", 0.85);
  }, [map, activePlanId, selectedBuildingPoiId]);
}
