"use client";

import React, { useEffect, useRef } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { useSceneStore, useWorldStore } from "@klorad/core";
import { easeToObservationPoints } from "../utils/camera";

const MapboxCameraSpringController: React.FC<{ map: MapboxMap | null }> = ({
  map,
}) => {
  const engine = useWorldStore((s) => s.engine);
  const sceneState = useSceneStore((state) => ({
    previewMode: state.previewMode,
    previewIndex: state.previewIndex,
    observationPoints: state.observationPoints,
    capturingPOV: state.capturingPOV,
  }));

  const { previewMode, previewIndex, observationPoints, capturingPOV } =
    sceneState;
  const cancelFreeCameraRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (engine !== "mapbox" || !map) return;

    cancelFreeCameraRef.current?.();
    cancelFreeCameraRef.current = null;
    try {
      map.stop();
    } catch {
      /* ignore */
    }

    if (
      previewMode &&
      observationPoints.length > 0 &&
      !capturingPOV &&
      map
    ) {
      const currentPoint = observationPoints[previewIndex];
      if (currentPoint?.position && currentPoint?.target) {
        const cancel = easeToObservationPoints(map, currentPoint, 1500);
        if (cancel) cancelFreeCameraRef.current = cancel;
      }
    }

    return () => {
      cancelFreeCameraRef.current?.();
      cancelFreeCameraRef.current = null;
      try {
        map.stop();
      } catch {
        /* ignore */
      }
    };
  }, [
    engine,
    previewMode,
    previewIndex,
    observationPoints,
    capturingPOV,
    map,
  ]);

  return null;
};

export default MapboxCameraSpringController;
