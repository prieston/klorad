"use client";

import { useEffect, useRef } from "react";
import type {
  Map as MapboxMap,
  GeoJSONSource,
  MapMouseEvent,
} from "mapbox-gl";
import { useSceneStore } from "@klorad/core";
import type { FloorPlan, POI, Room } from "@klorad/api";
import { FLOOR_HEIGHT_M } from "./useMapboxFloorSlabsLayer";

const SOURCE_ID = "campus-building-shells";
const FILL_LAYER_ID = "campus-building-shells-fill"; // solid shells (0.85)
const XRAY_LAYER_ID = "campus-building-shells-xray"; // active floor (0.18)
const OUTLINE_LAYER_ID = "campus-building-shells-outline";

interface ShellFeature {
  buildingPoiId: string;
  floor: number;
  synthesised: boolean;
  base: number;
  height: number;
  polygon: [number, number][];
}

function planHeight(p: FloorPlan): number {
  return p.heightM && p.heightM > 0 ? p.heightM : FLOOR_HEIGHT_M;
}

function extractShells(
  pois: POI[],
  plans: FloorPlan[],
  rooms: Room[]
): ShellFeature[] {
  const out: ShellFeature[] = [];
  for (const poi of pois) {
    const polygon = poi.linkedBuilding?.polygon;
    if (!polygon || polygon.length < 3) continue;

    const buildingPlans = plans.filter((p) => p.buildingId === poi.id);
    const floorIdxs = new Set<number>();
    buildingPlans.forEach((p) => floorIdxs.add(p.floor ?? 0));
    rooms
      .filter((r) => r.buildingId === poi.id)
      .forEach((r) => floorIdxs.add(r.floor));

    if (floorIdxs.size === 0) {
      const fallback = poi.linkedBuilding?.heightM ?? 12;
      out.push({
        buildingPoiId: poi.id,
        floor: 0,
        synthesised: true,
        base: 0,
        height: fallback,
        polygon,
      });
      continue;
    }

    for (const floor of [...floorIdxs].sort((a, b) => a - b)) {
      const plan = buildingPlans.find((p) => (p.floor ?? 0) === floor);
      const h = plan ? planHeight(plan) : FLOOR_HEIGHT_M;
      const base = floor * FLOOR_HEIGHT_M;
      out.push({
        buildingPoiId: poi.id,
        floor,
        synthesised: false,
        base,
        height: base + h,
        polygon,
      });
    }
  }
  return out;
}

function buildFeatureCollection(shells: ShellFeature[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: shells.map((s, i) => {
      const ring = [...s.polygon];
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) ring.push(first);
      return {
        type: "Feature",
        id: i,
        geometry: { type: "Polygon", coordinates: [ring] },
        properties: {
          buildingPoiId: s.buildingPoiId,
          floor: s.floor,
          synthesised: s.synthesised ? 1 : 0,
          base: s.base,
          height: s.height,
        },
      } satisfies GeoJSON.Feature;
    }),
  };
}

interface Options {
  selectedPoiId?: string | null;
  activeFloor?: number | null;
  onSelect?: (poiId: string) => void;
  /** When false, click + hover are ignored (e.g. during polygon draw). */
  clickEnabled?: boolean;
}

/**
 * Two-layer rendering of stacked building shells:
 *
 * - **Solid layer** (opacity 0.85) — paints every shell that should be
 *   fully visible. In idle mode that's every feature. In floor-mode it
 *   excludes the active floor of the selected building (which becomes
 *   x-ray) and any floor *above* the active one (clipped).
 * - **X-ray layer** (opacity 0.18) — only the active floor of the
 *   selected building. Lets you see the rooms inside the walls.
 *
 * We use two layers because Mapbox's `fill-extrusion-opacity` is not
 * data-driven, and the colour's alpha channel is dropped at render
 * time for fill-extrusion. Splitting by filter + per-layer constant
 * opacity is the only reliable way to drive per-feature transparency.
 */
export function useMapboxDrawnBuildingsLayer(
  pois: POI[],
  plans: FloorPlan[],
  rooms: Room[],
  opts: Options = {}
) {
  const map = useSceneStore((s) => s.mapboxMap as MapboxMap | null);
  const { selectedPoiId, activeFloor, onSelect, clickEnabled = true } = opts;
  const onSelectRef = useRef(onSelect);
  const clickEnabledRef = useRef(clickEnabled);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);
  useEffect(() => {
    clickEnabledRef.current = clickEnabled;
  }, [clickEnabled]);

  // Mount layers once per map.
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
            "fill-extrusion-color": "#94a3b8",
            "fill-extrusion-base": ["get", "base"],
            "fill-extrusion-height": ["get", "height"],
            "fill-extrusion-opacity": 0.85,
          },
        });
      }
      if (!map.getLayer(XRAY_LAYER_ID)) {
        map.addLayer({
          id: XRAY_LAYER_ID,
          type: "fill-extrusion",
          source: SOURCE_ID,
          // start hidden — selection effect flips this on
          filter: ["==", ["get", "buildingPoiId"], "__none__"] as never,
          paint: {
            "fill-extrusion-color": "#6B9CD8",
            "fill-extrusion-base": ["get", "base"],
            "fill-extrusion-height": ["get", "height"],
            "fill-extrusion-opacity": 0.18,
          },
        });
      }
      if (!map.getLayer(OUTLINE_LAYER_ID)) {
        map.addLayer({
          id: OUTLINE_LAYER_ID,
          type: "line",
          source: SOURCE_ID,
          paint: {
            "line-color": "#ffffff",
            "line-opacity": 0.6,
            "line-width": 1.2,
          },
        });
      }
      // Keep room layers ON TOP of the building shells. Mapbox renders
      // layers in style-add order, so the rooms (added by an earlier
      // hook) end up beneath if we don't push them up. Without this
      // the active floor's x-ray walls visually fight with the rooms
      // sitting on the same slab.
      // Re-order rooms on top of shells once per style reload —
      // calling `moveLayer` every idle tick triggers Mapbox to redo
      // collision placement, which makes labels visibly flicker.
      if (!promoted) {
        let movedAll = true;
        for (const id of [
          "campus-rooms-extrusion",
          "campus-rooms-outline",
          "campus-rooms-highlight",
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
    // `style.load` is one-shot. If the style already finished loading
    // before this hook mounted, the listener never fires. We *also*
    // hook `idle` (fires repeatedly during normal map use) and
    // `styledata` (fires whenever Mapbox re-applies the style — e.g.
    // after a setConfigProperty / basemap-import reload that wipes
    // custom layers). install() is idempotent so retries are safe.
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
      const f = map.queryRenderedFeatures(e.point, {
        layers: [FILL_LAYER_ID, XRAY_LAYER_ID],
      })[0];
      if (!f) return;
      const id = f.properties?.buildingPoiId as string | undefined;
      if (id && onSelectRef.current) {
        onSelectRef.current(id);
      }
    };
    const hoverEnter = () => {
      if (!clickEnabledRef.current) return;
      map.getCanvas().style.cursor = "pointer";
    };
    const hoverLeave = () => {
      map.getCanvas().style.cursor = "";
    };
    map.on("click", FILL_LAYER_ID, clickHandler);
    map.on("mouseenter", FILL_LAYER_ID, hoverEnter);
    map.on("mouseleave", FILL_LAYER_ID, hoverLeave);

    return () => {
      map.off("style.load", onStyleLoad);
      map.off("idle", onIdle);
      map.off("styledata", onStyleData);
      map.off("click", FILL_LAYER_ID, clickHandler);
      map.off("mouseenter", FILL_LAYER_ID, hoverEnter);
      map.off("mouseleave", FILL_LAYER_ID, hoverLeave);
      try {
        if (map.getLayer(OUTLINE_LAYER_ID)) map.removeLayer(OUTLINE_LAYER_ID);
        if (map.getLayer(XRAY_LAYER_ID)) map.removeLayer(XRAY_LAYER_ID);
        if (map.getLayer(FILL_LAYER_ID)) map.removeLayer(FILL_LAYER_ID);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      } catch {
        /* ignore */
      }
    };
  }, [map]);

  // Sync feature data. We don't gate on `isStyleLoaded()` — Mapbox
  // flips that flag false mid-config-change even when the source is
  // alive, and `setData` works fine as long as the source object is
  // present. Re-runs on every render of the parent because `pois /
  // plans / rooms` change identity, plus on every map `idle` event in
  // case the source was just (re)installed.
  useEffect(() => {
    if (!map) return;
    const apply = () => {
      const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      if (!src) return;
      try {
        src.setData(buildFeatureCollection(extractShells(pois, plans, rooms)));
      } catch {
        /* Mapbox sometimes throws if the source is mid-tear-down; the
           next idle / styledata tick will retry. */
      }
    };
    apply();
    const onIdle = () => apply();
    map.on("idle", onIdle);
    return () => {
      map.off("idle", onIdle);
    };
  }, [map, pois, plans, rooms]);

  // Selection / clipping.
  useEffect(() => {
    if (!map) return;
    if (!map.getLayer(FILL_LAYER_ID)) return;
    const sel = selectedPoiId ?? "";

    // Color expression on the SOLID layer — simply tint the selected
    // building's blocks Klorad-blue, others stay neutral grey.
    map.setPaintProperty(FILL_LAYER_ID, "fill-extrusion-color", [
      "case",
      ["==", ["get", "buildingPoiId"], sel],
      "#6B9CD8",
      "#94a3b8",
    ]);

    if (activeFloor === null || activeFloor === undefined) {
      // Idle: solid layer renders everything, x-ray layer hidden.
      map.setFilter(FILL_LAYER_ID, null);
      map.setFilter(OUTLINE_LAYER_ID, null);
      map.setFilter(
        XRAY_LAYER_ID,
        ["==", ["get", "buildingPoiId"], "__none__"] as never
      );
      return;
    }

    // Floor selected:
    //   solid layer: every feature OUTSIDE the selected building, plus
    //   floors strictly BELOW the active floor of the selected building.
    //   The active floor's walls are NOT rendered at all — Mapbox's
    //   depth-buffer would otherwise have a translucent shell occlude
    //   the rooms inside it. Removing the active-floor shell exposes
    //   the rooms directly.
    const solidFilter = [
      "any",
      ["!=", ["get", "buildingPoiId"], sel],
      [
        "all",
        ["==", ["get", "buildingPoiId"], sel],
        ["<", ["get", "floor"], activeFloor],
      ],
    ] as unknown[];
    map.setFilter(FILL_LAYER_ID, solidFilter as never);
    // Outline shows only floors <= active for the selected building so
    // the user still sees the active floor's footprint as a thin ring.
    map.setFilter(
      OUTLINE_LAYER_ID,
      [
        "any",
        ["!=", ["get", "buildingPoiId"], sel],
        [
          "all",
          ["==", ["get", "buildingPoiId"], sel],
          ["<=", ["get", "floor"], activeFloor],
        ],
      ] as never
    );
    // X-ray layer is permanently hidden in this strategy — Mapbox's
    // depth buffer makes a translucent enclosing extrusion occlude
    // the rooms inside, so we just don't render the active floor's
    // walls at all. The slab + room layers handle the visualization.
    map.setFilter(
      XRAY_LAYER_ID,
      ["==", ["get", "buildingPoiId"], "__none__"] as never
    );
  }, [map, selectedPoiId, activeFloor]);
}
