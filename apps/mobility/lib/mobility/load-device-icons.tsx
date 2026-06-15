"use client";

/**
 * Client-side helper: load every stock + custom device icon into a
 * Mapbox map as an addressable image. Idempotent on the icon name,
 * so the operator console and the public world viewer can both
 * invoke this at every style swap without paying the rasterisation
 * cost twice.
 *
 * Naming:
 *   - Stock entries register under `device-<stock key>`, SDF.
 *   - Custom entries register under `device-custom:<id>`. SVG → SDF
 *     so Mapbox can tint them with `icon-color`. PNG/JPEG/WebP are
 *     added non-SDF, preserving the operator's original colours.
 */
import { createElement } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { STOCK_DEVICE_ICONS } from "./device-icons";
import type { CustomIconRef } from "./device-style-resolver";
import { rasteriseSvg } from "./icon-rasteriser";

interface CacheEntry {
  data: ImageData;
  sdf: boolean;
}

const RASTER_CACHE = new Map<string, CacheEntry>();

/** Lookups that survive style swaps — the cache is per-icon, the
 *  `addImage` re-add is per-style. */
async function ensureStockIcons(map: MapboxMap): Promise<void> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  for (const entry of STOCK_DEVICE_ICONS) {
    const name = `device-${entry.key}`;
    if (map.hasImage(name)) continue;
    let cached = RASTER_CACHE.get(name);
    if (!cached) {
      const svg = renderToStaticMarkup(
        createElement(entry.Icon, {
          size: 96,
          strokeWidth: 2,
          color: "white",
        }),
      );
      const data = await rasteriseSvg(svg);
      if (!data) continue;
      cached = { data, sdf: true };
      RASTER_CACHE.set(name, cached);
    }
    try {
      map.addImage(name, cached.data, { sdf: cached.sdf });
    } catch {
      /* same name — fine */
    }
  }
}

/** Fetch a custom upload + rasterise. SVGs reuse the same path as
 *  stock icons so they tint via SDF; raster types are decoded by the
 *  browser and pushed as full-colour images. */
async function rasteriseCustomIcon(
  icon: CustomIconRef,
): Promise<CacheEntry | null> {
  if (icon.contentType === "image/svg+xml") {
    const res = await fetch(icon.url);
    if (!res.ok) return null;
    const svg = await res.text();
    const data = await rasteriseSvg(svg);
    if (!data) return null;
    return { data, sdf: true };
  }
  // Raster path: <img> → canvas. The image is loaded crossOrigin so
  // the canvas pixel buffer is readable (DO Spaces is configured to
  // return permissive CORS on public assets — same convention as
  // campus's branding pipeline).
  const img = await new Promise<HTMLImageElement | null>((resolve) => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => resolve(el);
    el.onerror = () => resolve(null);
    el.src = icon.url;
  });
  if (!img) return null;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  // Letterbox so non-square uploads don't stretch.
  const ratio = Math.min(size / img.width, size / img.height);
  const w = img.width * ratio;
  const h = img.height * ratio;
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  return { data: ctx.getImageData(0, 0, size, size), sdf: false };
}

async function ensureCustomIcons(
  map: MapboxMap,
  customIcons: Record<string, CustomIconRef>,
): Promise<void> {
  for (const icon of Object.values(customIcons)) {
    const name = `device-custom:${icon.id}`;
    if (map.hasImage(name)) continue;
    let cached = RASTER_CACHE.get(name);
    if (!cached) {
      const data = await rasteriseCustomIcon(icon);
      if (!data) continue;
      cached = data;
      RASTER_CACHE.set(name, cached);
    }
    try {
      map.addImage(name, cached.data, { sdf: cached.sdf });
    } catch {
      /* same name — fine */
    }
  }
}

/**
 * Ensure stock + custom icons are present on the map. Re-runs after
 * a `setStyle` swap because the style change wipes user-added
 * images. `customIcons` defaults to empty so callers that don't yet
 * resolve a project's icons (e.g. transient previews) still work.
 */
export async function loadDeviceIconsIntoMap(
  map: MapboxMap,
  customIcons: Record<string, CustomIconRef> = {},
): Promise<void> {
  await ensureStockIcons(map);
  await ensureCustomIcons(map, customIcons);
}
