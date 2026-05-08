import type { Map as MapboxMap } from "mapbox-gl";
import type {
  MapboxSceneData,
  MapboxSceneLayer,
} from "@klorad/core";

const SRC_PREFIX = "klorad-src-";
const LAYER_PREFIX = "klorad-layer-";

function removeKloradLayers(map: MapboxMap) {
  const style = map.getStyle();
  if (!style?.layers) return;
  const toRemove: string[] = [];
  for (const layer of style.layers) {
    if (layer.id.startsWith(LAYER_PREFIX)) toRemove.push(layer.id);
  }
  for (const id of toRemove) {
    try {
      if (map.getLayer(id)) map.removeLayer(id);
    } catch {
      /* ignore */
    }
  }
  const sources = style.sources ? Object.keys(style.sources) : [];
  for (const sid of sources) {
    if (!sid.startsWith(SRC_PREFIX)) continue;
    try {
      if (map.getSource(sid)) map.removeSource(sid);
    } catch {
      /* ignore */
    }
  }
}

function addGeojsonLayer(map: MapboxMap, layer: MapboxSceneLayer) {
  if (layer.visible === false) return;
  const sid = `${SRC_PREFIX}${layer.id}`;
  const lid = `${LAYER_PREFIX}${layer.id}`;
  let data: object = { type: "FeatureCollection", features: [] };
  if (layer.geojson && typeof layer.geojson === "object") {
    data = layer.geojson as object;
  }
  map.addSource(sid, { type: "geojson", data: data as never });

  const commonLayout = (layer.layout || {}) as Record<string, unknown>;
  const commonPaint = (layer.paint || {}) as Record<string, unknown>;

  switch (layer.type) {
    case "geojson-fill":
      map.addLayer({
        id: lid,
        type: "fill",
        source: sid,
        layout: commonLayout,
        paint: {
          "fill-color": "#3b82f6",
          "fill-opacity": 0.4,
          ...commonPaint,
        },
        filter: layer.filter as never,
      });
      break;
    case "geojson-line":
      map.addLayer({
        id: lid,
        type: "line",
        source: sid,
        layout: commonLayout,
        paint: {
          "line-color": "#2563eb",
          "line-width": 2,
          ...commonPaint,
        },
        filter: layer.filter as never,
      });
      break;
    case "geojson-circle":
      map.addLayer({
        id: lid,
        type: "circle",
        source: sid,
        layout: commonLayout,
        paint: {
          "circle-radius": 6,
          "circle-color": "#eab308",
          ...commonPaint,
        },
        filter: layer.filter as never,
      });
      break;
    case "fill-extrusion":
      map.addLayer({
        id: lid,
        type: "fill-extrusion",
        source: sid,
        layout: commonLayout,
        paint: {
          "fill-extrusion-color": "#64748b",
          "fill-extrusion-height": layer.fillExtrusionHeight ?? 3,
          "fill-extrusion-base": layer.fillExtrusionBase ?? 0,
          "fill-extrusion-opacity": 0.85,
          ...commonPaint,
        },
        filter: layer.filter as never,
      });
      break;
    default:
      break;
  }
}

/** Apply georeferenced floor plan images (corners: [tl, tr, br, bl] in lng/lat). */
function addFloorRasters(
  map: MapboxMap,
  rasters: NonNullable<MapboxSceneData["floorPlanRasters"]>
) {
  for (const fp of rasters) {
    if (!fp.url || !fp.coordinates?.length) continue;
    const sid = `${SRC_PREFIX}fp-${fp.id}`;
    const lid = `${LAYER_PREFIX}fp-${fp.id}`;
    map.addSource(sid, {
      type: "image",
      url: fp.url,
      coordinates: fp.coordinates as [
        [number, number],
        [number, number],
        [number, number],
        [number, number],
      ],
    });
    map.addLayer({
      id: lid,
      type: "raster",
      source: sid,
      paint: { "raster-opacity": 0.9 },
    });
  }
}

export function applyMapboxSceneToMap(map: MapboxMap, data: MapboxSceneData) {
  if (!map.isStyleLoaded()) return;
  removeKloradLayers(map);
  for (const layer of data.layers || []) {
    try {
      addGeojsonLayer(map, layer);
    } catch {
      /* invalid layer */
    }
  }
  if (data.floorPlanRasters?.length) {
    try {
      addFloorRasters(map, data.floorPlanRasters);
    } catch {
      /* ignore */
    }
  }
}
