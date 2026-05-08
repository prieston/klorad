import type { Map as MapboxMap } from "mapbox-gl";

function cancelMapCameraAnimation(map: MapboxMap) {
  try {
    map.stop();
  } catch {
    /* ignore */
  }
}

export function flyToMapboxPosition(
  map: MapboxMap,
  lng: number,
  lat: number,
  zoom?: number
) {
  map.flyTo({
    center: [lng, lat],
    zoom: zoom ?? Math.max(map.getZoom(), 16),
    duration: 2000,
    essential: true,
  });
}

export function captureMapboxObservationFromMap(map: MapboxMap): {
  position: [number, number, number];
  target: [number, number, number];
  mapboxCamera: { pitch: number; bearing: number; zoom: number };
  mapboxUseFreeCameraPose: boolean;
} {
  const mapboxCamera = {
    pitch: map.getPitch(),
    bearing: map.getBearing(),
    zoom: map.getZoom(),
  };

  try {
    const free = map.getFreeCameraOptions();
    const p = free.position;
    if (p) {
      const ll = p.toLngLat();
      const camAlt = p.toAltitude();
      const c = map.getCenter();
      const ground =
        map.queryTerrainElevation({ lng: c.lng, lat: c.lat }) ?? 0;
      return {
        position: [ll.lng, ll.lat, camAlt],
        target: [c.lng, c.lat, ground],
        mapboxCamera,
        mapboxUseFreeCameraPose: true,
      };
    }
  } catch {
    /* fall through */
  }

  const c = map.getCenter();
  const pitchRad = (map.getPitch() * Math.PI) / 180;
  const bearingRad = (map.getBearing() * Math.PI) / 180;
  const metersPerUnit = 120;
  const dx = metersPerUnit * Math.sin(bearingRad) * Math.cos(pitchRad);
  const dy = metersPerUnit * Math.cos(bearingRad) * Math.cos(pitchRad);
  const latScale = 111320;
  const lngScale = 111320 * Math.cos((c.lat * Math.PI) / 180);
  const tLng = c.lng + dx / lngScale;
  const tLat = c.lat + dy / latScale;
  const alt = metersPerUnit * Math.sin(pitchRad);
  return {
    position: [c.lng, c.lat, alt],
    target: [tLng, tLat, alt * 0.5],
    mapboxCamera,
    mapboxUseFreeCameraPose: false,
  };
}

/**
 * Move to an observation using Mapbox `flyTo` (smooth animation).
 * When `mapboxCamera` exists, `center` is **target** lng/lat (ground under the crosshair at capture),
 * with saved zoom / pitch / bearing.
 */
export function easeToObservationPoints(
  map: MapboxMap | null,
  point: {
    position: [number, number, number] | null;
    target: [number, number, number] | null;
    mapboxCamera?: { pitch: number; bearing: number; zoom: number } | null;
    mapboxUseFreeCameraPose?: boolean;
  } | null,
  duration = 1500
): (() => void) | undefined {
  if (!map || !point?.position || !point?.target) return undefined;
  const [lng, lat] = point.position;
  const [tlng, tlat] = point.target;

  const cancel = () => cancelMapCameraAnimation(map);

  const cam = point.mapboxCamera;
  if (
    cam &&
    Number.isFinite(cam.pitch) &&
    Number.isFinite(cam.bearing) &&
    Number.isFinite(cam.zoom)
  ) {
    map.flyTo({
      center: [tlng, tlat],
      zoom: cam.zoom,
      pitch: cam.pitch,
      bearing: cam.bearing,
      duration,
      essential: true,
    });
    return cancel;
  }

  const bearing = (Math.atan2(tlng - lng, tlat - lat) * 180) / Math.PI;
  map.flyTo({
    center: [lng, lat],
    zoom: Math.max(16, map.getZoom()),
    pitch: 55,
    bearing,
    duration,
    essential: true,
  });
  return cancel;
}
