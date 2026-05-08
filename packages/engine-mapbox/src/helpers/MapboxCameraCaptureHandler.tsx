"use client";

import { useEffect } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { useSceneStore, useWorldStore } from "@klorad/core";
import { captureMapboxObservationFromMap } from "../utils/camera";

const MapboxCameraCaptureHandler: React.FC<{ map: MapboxMap | null }> = ({
  map,
}) => {
  const engine = useWorldStore((s) => s.engine);
  const capturingPOV = useSceneStore((s) => s.capturingPOV);
  const selectedObservation = useSceneStore((s) => s.selectedObservation);
  const updateObservationPoint = useSceneStore(
    (s) => s.updateObservationPoint
  );
  const setCapturingPOV = useSceneStore((s) => s.setCapturingPOV);

  useEffect(() => {
    if (engine !== "mapbox") return;
    if (!capturingPOV || !selectedObservation || !map) return;

    setCapturingPOV(false);
    try {
      const {
        position,
        target,
        mapboxCamera,
        mapboxUseFreeCameraPose,
      } = captureMapboxObservationFromMap(map);
      updateObservationPoint(selectedObservation.id, {
        position,
        target,
        mapboxCamera,
        mapboxUseFreeCameraPose,
      });
    } catch {
      /* ignore */
    }
  }, [
    engine,
    capturingPOV,
    selectedObservation,
    map,
    updateObservationPoint,
    setCapturingPOV,
  ]);

  return null;
};

export default MapboxCameraCaptureHandler;
