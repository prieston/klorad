import type { Map as MapboxMap } from "mapbox-gl";
import type { MapboxSceneData } from "@klorad/core";
import { DEFAULT_MAPBOX_SCENE_DATA } from "@klorad/core";

const TERRAIN_SOURCE_ID = "klorad-terrain-dem";

function trySetConfig(
  map: MapboxMap,
  importId: string,
  key: string,
  value: unknown
) {
  if (value === undefined) return;
  try {
    map.setConfigProperty(importId, key, value);
  } catch {
    /* Classic styles have no basemap import */
  }
}

/**
 * Applies projection, terrain, fog, and Mapbox Standard `basemap` config.
 * Safe on non-Standard styles (unsupported calls no-op).
 */
export function applyMapboxEnvironmentToMap(
  map: MapboxMap,
  data: MapboxSceneData
) {
  if (!map.isStyleLoaded()) return;

  const projection = data.projection ?? DEFAULT_MAPBOX_SCENE_DATA.projection!;
  try {
    map.setProjection(projection);
  } catch {
    /* ignore */
  }

  const terr =
    data.terrain ?? DEFAULT_MAPBOX_SCENE_DATA.terrain!;
  if (terr.enabled) {
    if (!map.getSource(TERRAIN_SOURCE_ID)) {
      try {
        map.addSource(TERRAIN_SOURCE_ID, {
          type: "raster-dem",
          url: "mapbox://mapbox.mapbox-terrain-dem-v1",
          tileSize: 512,
          maxzoom: 14,
        });
      } catch {
        /* ignore */
      }
    }
    try {
      map.setTerrain({
        source: TERRAIN_SOURCE_ID,
        exaggeration: terr.exaggeration,
      });
    } catch {
      /* ignore */
    }
  } else {
    try {
      map.setTerrain(null);
    } catch {
      /* ignore */
    }
    try {
      if (map.getSource(TERRAIN_SOURCE_ID)) {
        map.removeSource(TERRAIN_SOURCE_ID);
      }
    } catch {
      /* ignore */
    }
  }

  const fog = data.fog ?? DEFAULT_MAPBOX_SCENE_DATA.fog!;
  if (fog.enabled) {
    try {
      map.setFog({
        color: fog.color ?? "rgb(186, 214, 234)",
        "high-color": fog.highColor ?? "#245bde",
        "horizon-blend": fog.horizonBlend ?? 0.15,
        "space-color": fog.spaceColor ?? "#4a5b7a",
        "star-intensity": fog.starIntensity ?? 0,
        range: fog.range ?? [0.8, 8],
      });
    } catch {
      /* ignore */
    }
  } else {
    try {
      map.setFog({});
    } catch {
      /* ignore */
    }
  }

  const std =
    data.standardBasemap ?? DEFAULT_MAPBOX_SCENE_DATA.standardBasemap!;
  const importId = std.importId ?? "basemap";

  trySetConfig(map, importId, "theme", std.theme);
  trySetConfig(map, importId, "lightPreset", std.lightPreset);
  trySetConfig(map, importId, "show3dObjects", std.show3dObjects);
  trySetConfig(map, importId, "show3dBuildings", std.show3dBuildings);
  trySetConfig(map, importId, "show3dTrees", std.show3dTrees);
  trySetConfig(map, importId, "show3dLandmarks", std.show3dLandmarks);
  trySetConfig(map, importId, "showPedestrianRoads", std.showPedestrianRoads);
  trySetConfig(map, importId, "showPlaceLabels", std.showPlaceLabels);
  trySetConfig(
    map,
    importId,
    "showPointOfInterestLabels",
    std.showPointOfInterestLabels
  );
  trySetConfig(map, importId, "showRoadLabels", std.showRoadLabels);
  trySetConfig(map, importId, "showTransitLabels", std.showTransitLabels);
  trySetConfig(map, importId, "showAdminBoundaries", std.showAdminBoundaries);
}
