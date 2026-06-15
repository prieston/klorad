"use client";

/**
 * Client-side helper: load every stock device icon into a Mapbox map
 * as an SDF image. Idempotent on the icon *name*, so the operator
 * console and the public world viewer can both invoke this at every
 * style swap without paying the rasterisation cost twice.
 */
import { createElement } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { STOCK_DEVICE_ICONS } from "./device-icons";
import { rasteriseSvg } from "./icon-rasteriser";

const RASTER_CACHE = new Map<string, ImageData>();

/**
 * Ensure every stock icon is present on the map as an SDF image
 * named `device-<key>`. Re-adds after a `setStyle` swap because the
 * style change wipes user-added images.
 *
 * `react-dom/server` is dynamically imported so the (sizeable) server
 * renderer doesn't land in the initial client bundle — map init is
 * already async and pays its cost off the critical path.
 */
export async function loadDeviceIconsIntoMap(map: MapboxMap): Promise<void> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  for (const entry of STOCK_DEVICE_ICONS) {
    const name = `device-${entry.key}`;
    if (map.hasImage(name)) continue;
    let data = RASTER_CACHE.get(entry.key) ?? null;
    if (!data) {
      const svg = renderToStaticMarkup(
        createElement(entry.Icon, {
          size: 96,
          strokeWidth: 2,
          color: "white",
        }),
      );
      data = await rasteriseSvg(svg);
      if (!data) continue;
      RASTER_CACHE.set(entry.key, data);
    }
    try {
      map.addImage(name, data, { sdf: true });
    } catch {
      /* image already added under this name — fine */
    }
  }
}
