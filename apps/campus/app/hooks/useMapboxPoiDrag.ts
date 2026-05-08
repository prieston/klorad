"use client";

import { useEffect, useRef } from "react";
import type {
  Map as MapboxMap,
  GeoJSONSource,
  MapMouseEvent,
} from "mapbox-gl";
import { useSceneStore } from "@klorad/core";
import { POI_SOURCE_ID, POI_PIN_LAYER_ID } from "./useMapboxPoiLayer";

export interface UseMapboxPoiDragOptions {
  enabled: boolean;
  /** Commit the drag — called on mouseup with final coords. */
  onPoiMoved: (poiId: string, lng: number, lat: number) => void;
}

/**
 * Makes POI pins draggable when `enabled`. Hooks into the existing POI
 * GeoJSON source, so the drag is visually smooth — the pin follows the
 * cursor because we `setData` the source on every mousemove with the
 * dragged feature's coordinates updated. Map panning is disabled while
 * a drag is in progress.
 */
export function useMapboxPoiDrag({ enabled, onPoiMoved }: UseMapboxPoiDragOptions) {
  const map = useSceneStore((s) => s.mapboxMap as MapboxMap | null);
  const onPoiMovedRef = useRef(onPoiMoved);
  onPoiMovedRef.current = onPoiMoved;

  useEffect(() => {
    if (!map || !enabled) {
      if (map) map.getCanvas().style.cursor = "";
      return;
    }

    let dragging: string | null = null;

    const getSource = () =>
      map.getSource(POI_SOURCE_ID) as GeoJSONSource | undefined;

    const onEnter = () => {
      if (!dragging) map.getCanvas().style.cursor = "grab";
    };
    const onLeave = () => {
      if (!dragging) map.getCanvas().style.cursor = "";
    };

    const onMouseDown = (e: MapMouseEvent & { features?: GeoJSON.Feature[] }) => {
      const f = e.features?.[0];
      const id = f?.properties?.id ?? f?.id;
      if (!id) return;
      // Stop the map from panning while we drag the pin
      e.preventDefault();
      dragging = String(id);
      map.getCanvas().style.cursor = "grabbing";
      map.dragPan.disable();

      map.on("mousemove", onMouseMove);
      map.once("mouseup", onMouseUp);
    };

    const onMouseMove = (e: MapMouseEvent) => {
      if (!dragging) return;
      const source = getSource();
      if (!source) return;

      // Mutate only the dragged feature's geometry
      const current = (source.serialize() as { data?: GeoJSON.FeatureCollection }).data;
      if (!current || current.type !== "FeatureCollection") return;
      const next: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: current.features.map((feat) => {
          if ((feat.properties as { id?: string })?.id !== dragging) return feat;
          if (feat.geometry.type !== "Point") return feat;
          return {
            ...feat,
            geometry: {
              ...feat.geometry,
              coordinates: [e.lngLat.lng, e.lngLat.lat],
            },
          };
        }),
      };
      source.setData(next);
    };

    const onMouseUp = (e: MapMouseEvent) => {
      if (!dragging) return;
      const id = dragging;
      dragging = null;
      map.off("mousemove", onMouseMove);
      map.getCanvas().style.cursor = "grab";
      map.dragPan.enable();
      onPoiMovedRef.current(id, e.lngLat.lng, e.lngLat.lat);
    };

    map.on("mouseenter", POI_PIN_LAYER_ID, onEnter);
    map.on("mouseleave", POI_PIN_LAYER_ID, onLeave);
    map.on("mousedown", POI_PIN_LAYER_ID, onMouseDown);

    return () => {
      map.off("mouseenter", POI_PIN_LAYER_ID, onEnter);
      map.off("mouseleave", POI_PIN_LAYER_ID, onLeave);
      map.off("mousedown", POI_PIN_LAYER_ID, onMouseDown);
      map.off("mousemove", onMouseMove);
      map.getCanvas().style.cursor = "";
      map.dragPan.enable();
    };
  }, [map, enabled]);
}
