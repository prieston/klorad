import type { Map as MapboxMap, MapMouseEvent } from "mapbox-gl";

/**
 * Register a one-shot style click handler for map placement (lng, lat, alt meters).
 * Returns cleanup.
 */
export function setupMapboxClickSelector(
  map: MapboxMap,
  onPick: (position: [number, number, number]) => void
): () => void {
  const handler = (e: MapMouseEvent) => {
    onPick([e.lngLat.lng, e.lngLat.lat, 0]);
  };
  map.on("click", handler);
  return () => {
    map.off("click", handler);
  };
}
