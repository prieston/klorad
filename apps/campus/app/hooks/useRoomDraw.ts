"use client";

import { useEffect, useRef } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import { useSceneStore } from "@klorad/core";

interface Options {
  /** When true, the draw tool is mounted and starts in polygon mode. */
  active: boolean;
  /** Called with the closed polygon ring once the user double-clicks to finish. */
  onFinish: (polygon: [number, number][]) => void;
  /** Called when the user presses Escape without finishing. */
  onCancel?: () => void;
}

/**
 * Lightweight wrapper around `@mapbox/mapbox-gl-draw` that activates a
 * single polygon draw session. The control is never visible — the parent
 * toolbar drives the mode. Escape cancels; finishing a polygon calls
 * `onFinish` exactly once and the control is torn down.
 *
 * The callbacks live in refs so a parent re-render with new inline
 * handlers doesn't tear down the draw control mid-polygon.
 */
export function useRoomDraw({ active, onFinish, onCancel }: Options) {
  const map = useSceneStore((s) => s.mapboxMap as MapboxMap | null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const finishedRef = useRef(false);
  const onFinishRef = useRef(onFinish);
  const onCancelRef = useRef(onCancel);

  // Keep refs current without re-running the mount effect.
  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);
  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    if (!map || !active) return;
    finishedRef.current = false;

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {},
      defaultMode: "draw_polygon",
      styles: [
        {
          id: "gl-draw-polygon-fill",
          type: "fill",
          filter: ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]],
          paint: { "fill-color": "#6B9CD8", "fill-opacity": 0.2 },
        },
        {
          id: "gl-draw-polygon-stroke",
          type: "line",
          filter: ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]],
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#6B9CD8", "line-width": 2, "line-dasharray": [2, 2] },
        },
        {
          id: "gl-draw-polygon-and-line-vertex-halo-active",
          type: "circle",
          filter: [
            "all",
            ["==", "meta", "vertex"],
            ["==", "$type", "Point"],
            ["!=", "mode", "static"],
          ],
          paint: { "circle-radius": 5, "circle-color": "#FFFFFF" },
        },
        {
          id: "gl-draw-polygon-and-line-vertex-active",
          type: "circle",
          filter: [
            "all",
            ["==", "meta", "vertex"],
            ["==", "$type", "Point"],
            ["!=", "mode", "static"],
          ],
          paint: { "circle-radius": 3, "circle-color": "#6B9CD8" },
        },
      ],
    });
    // Type: the library extends IControl but types lag Mapbox GL.
    map.addControl(draw as unknown as Parameters<typeof map.addControl>[0]);
    drawRef.current = draw;

    const handleCreate = (e: { features: Array<GeoJSON.Feature> }) => {
      const feature = e.features[0];
      if (!feature || feature.geometry.type !== "Polygon") return;
      const ring = feature.geometry.coordinates[0] as [number, number][];
      if (ring.length < 4) return; // rings include the closing duplicate point
      finishedRef.current = true;
      onFinishRef.current?.(ring);
    };
    map.on("draw.create", handleCreate);

    const handleKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape" && !finishedRef.current) {
        onCancelRef.current?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    // Crosshair cursor while drawing. We add a class on the canvas
    // container so a CSS rule (in global.css) wins over Mapbox's hover
    // handlers that reset the cursor on idle / mouseenter events.
    const canvas = map.getCanvas();
    const container = canvas.parentElement as HTMLElement | null;
    container?.classList.add("klorad-drawing-room");

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      map.off("draw.create", handleCreate);
      container?.classList.remove("klorad-drawing-room");
      try {
        if (drawRef.current) {
          map.removeControl(
            drawRef.current as unknown as Parameters<typeof map.removeControl>[0]
          );
        }
      } catch {
        /* ignore — control may already be removed */
      }
      drawRef.current = null;
    };
  }, [map, active]);
}
