"use client";

import { useEffect, useRef, useState } from "react";
import { Spinner } from "@klorad/design-system";
import type { MappedinVenue } from "./config";

/**
 * The MappedIn indoor viewer.
 *
 * Renders a 3D indoor venue (multi-floor, pan / zoom / rotate, floor
 * switching) via the MappedIn Web SDK. This is the *single* place the
 * SDK is imported — the swap-out seam for the future in-house engine.
 *
 * The SDK is dynamically imported inside the effect so it never
 * touches the server bundle and stays out of the main chunk.
 */
export function MappedinViewer({ venue }: { venue: MappedinVenue }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // The SDK's MapView; typed loosely so we don't leak SDK types past
    // this file. `destroy()` tears down the WebGL context on unmount.
    let mapView: { destroy?: () => void } | null = null;

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
        mapView = await show3dMap(el, mapData);
        if (cancelled) {
          mapView?.destroy?.();
          return;
        }
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
      mapView?.destroy?.();
    };
  }, [venue.key, venue.secret, venue.mapId]);

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
    </div>
  );
}
