"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Spinner } from "@klorad/design-system";
import type { MapData, MapView, Space } from "@mappedin/mappedin-js";
import type { MappedinVenue } from "./config";
import { WayfindingControls, type SpaceOption } from "./WayfindingControls";

/**
 * The MappedIn indoor viewer.
 *
 * Renders a 3D indoor venue (multi-floor, pan / zoom / rotate, floor
 * switching) via the MappedIn Web SDK, plus a directions panel that
 * routes between two spaces. This file is the *single* place the SDK
 * is imported — the swap-out seam for the future in-house engine.
 *
 * The SDK is dynamically imported inside the effect so it never
 * touches the server bundle and stays out of the main chunk. The
 * `import type` above is erased at build, so it costs nothing.
 */
export function MappedinViewer({ venue }: { venue: MappedinVenue }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapViewRef = useRef<MapView | null>(null);
  const mapDataRef = useRef<MapData | null>(null);
  // Named spaces by id — the route handlers need the real Space
  // objects, while the picker UI only needs `{ id, name }`.
  const spacesRef = useRef<Map<string, Space>>(new Map());

  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);
  const [spaces, setSpaces] = useState<SpaceOption[]>([]);
  const [routing, setRouting] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let view: MapView | null = null;

    void (async () => {
      const el = containerRef.current;
      if (!el) return;
      setStatus("loading");
      setError(null);
      try {
        const { getMapData, show3dMap } = await import(
          "@mappedin/mappedin-js"
        );
        const mapData = await getMapData({
          key: venue.key,
          secret: venue.secret,
          mapId: venue.mapId,
        });
        if (cancelled) return;
        view = await show3dMap(el, mapData);
        if (cancelled) {
          (view as { destroy?: () => void }).destroy?.();
          return;
        }
        mapViewRef.current = view;
        mapDataRef.current = mapData;

        // Collect named spaces for the directions pickers.
        const byId = new Map<string, Space>();
        for (const space of mapData.getByType("space")) {
          if (space.name) byId.set(space.id, space);
        }
        spacesRef.current = byId;
        setSpaces(
          [...byId.values()]
            .map((s) => ({ id: s.id, name: s.name as string }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
        setStatus("ready");
      } catch (e) {
        if (cancelled) return;
        setError(
          e instanceof Error ? e.message : "Failed to load the indoor map",
        );
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      (view as { destroy?: () => void } | null)?.destroy?.();
      mapViewRef.current = null;
      mapDataRef.current = null;
    };
  }, [venue.key, venue.secret, venue.mapId]);

  const handleRoute = useCallback(async (fromId: string, toId: string) => {
    const mapData = mapDataRef.current;
    const mapView = mapViewRef.current;
    if (!mapData || !mapView) return;
    const from = spacesRef.current.get(fromId);
    const to = spacesRef.current.get(toId);
    if (!from || !to) return;

    setRouting(true);
    setRouteError(null);
    try {
      mapView.Navigation.clear();
      const directions = await mapData.getDirections(from, to);
      if (!directions) {
        setRouteError("No route between those spaces.");
        return;
      }
      await mapView.Navigation.draw(directions);
    } catch (e) {
      setRouteError(e instanceof Error ? e.message : "Routing failed");
    } finally {
      setRouting(false);
    }
  }, []);

  const handleClear = useCallback(() => {
    mapViewRef.current?.Navigation.clear();
    setRouteError(null);
  }, []);

  return (
    <div className="relative h-full w-full bg-bg">
      <div ref={containerRef} className="h-full w-full" />

      {status === "loading" ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex items-center gap-3 text-sm text-text-secondary">
            <Spinner />
            Loading indoor map…
          </span>
        </div>
      ) : null}

      {status === "error" ? (
        <div className="absolute inset-0 flex items-center justify-center p-8">
          <div className="max-w-sm rounded-2xl border border-line-soft bg-surface-1 p-5 text-center shadow-glass">
            <p className="text-sm font-medium text-text-primary">
              Indoor map unavailable
            </p>
            <p className="mt-1 text-xs text-text-tertiary">{error}</p>
          </div>
        </div>
      ) : null}

      {status === "ready" && spaces.length >= 2 ? (
        <WayfindingControls
          spaces={spaces}
          routing={routing}
          error={routeError}
          onRoute={(from, to) => void handleRoute(from, to)}
          onClear={handleClear}
        />
      ) : null}
    </div>
  );
}
