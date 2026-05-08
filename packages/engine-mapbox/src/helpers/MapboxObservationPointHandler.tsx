"use client";

import { useEffect } from "react";
import { useSceneStore, useWorldStore } from "@klorad/core";

const MapboxObservationPointHandler: React.FC = () => {
  const engine = useWorldStore((s) => s.engine);
  const addingObservation = useSceneStore((state) => state.addingObservation);
  const addObservationPoint = useSceneStore(
    (state) => state.addObservationPoint
  );

  useEffect(() => {
    if (engine !== "mapbox") return;
    if (addingObservation) {
      addObservationPoint();
    }
  }, [engine, addingObservation, addObservationPoint]);

  return null;
};

export default MapboxObservationPointHandler;
