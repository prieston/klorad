"use client";

import { useEffect } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { useSceneStore, useWorldStore } from "@klorad/core";

type Handlerish = { disable: () => void; enable: () => void };

function forEachHandler(map: MapboxMap, fn: (h: Handlerish) => void) {
  const handlers: Handlerish[] = [
    map.scrollZoom,
    map.boxZoom,
    map.dragRotate,
    map.dragPan,
    map.keyboard,
    map.doubleClickZoom,
    map.touchZoomRotate,
    map.touchPitch,
  ];
  for (const h of handlers) {
    try {
      fn(h);
    } catch {
      /* ignore */
    }
  }
}

/**
 * In observation preview, disable pan/zoom/rotate so only scripted flyTo moves the camera.
 * Re-enables while capturing POV so the user can frame the shot.
 */
export function useMapboxPreviewInteractionLock(map: MapboxMap | null) {
  const engine = useWorldStore((s) => s.engine);
  const previewMode = useSceneStore((s) => s.previewMode);
  const capturingPOV = useSceneStore((s) => s.capturingPOV);

  useEffect(() => {
    if (!map || engine !== "mapbox") return;

    const lock = previewMode && !capturingPOV;
    if (lock) {
      forEachHandler(map, (h) => h.disable());
    } else {
      forEachHandler(map, (h) => h.enable());
    }

    return () => {
      forEachHandler(map, (h) => h.enable());
    };
  }, [map, engine, previewMode, capturingPOV]);
}
