"use client";

import type { Map as MapboxMap } from "mapbox-gl";

/**
 * Capture the current Mapbox canvas as a PNG data URL. Waits for the map to
 * be idle so we don't snapshot mid-tile-load. Times out after 8s.
 */
export async function captureMapboxScreenshot(
  map: MapboxMap | null
): Promise<string | null> {
  if (!map || typeof map.getCanvas !== "function") {
    throw new Error("Mapbox map not ready");
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    const to = setTimeout(() => {
      if (!settled) reject(new Error("Mapbox screenshot timed out"));
    }, 8000);
    const finish = () => {
      try {
        const canvas = map.getCanvas() as HTMLCanvasElement;
        settled = true;
        clearTimeout(to);
        resolve(canvas?.toDataURL("image/png") ?? null);
      } catch (e) {
        settled = true;
        clearTimeout(to);
        reject(e);
      }
    };
    const run = () => {
      map.once("idle", finish);
      map.triggerRepaint?.();
    };
    if (map.isStyleLoaded?.()) run();
    else map.once("load", run);
  });
}
