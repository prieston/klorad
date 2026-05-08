"use client";

import { useSceneStore } from "@klorad/core";
import {
  MapboxBuildingInteractionHandler,
  MapboxCameraCaptureHandler,
  MapboxObservationPointHandler,
  MapboxCameraSpringController,
} from "./helpers";
import { useMapboxSceneSync } from "./hooks/useMapboxSceneSync";
import { useMapboxThreeboxModels } from "./hooks/useMapboxThreeboxModels";
import { useMapboxPreviewInteractionLock } from "./hooks/useMapboxPreviewInteractionLock";
import type { Map as MapboxMap } from "mapbox-gl";

export function MapboxViewerContent({ map }: { map: MapboxMap | null }) {
  const mapboxSceneData = useSceneStore((s) => s.mapboxSceneData);
  useMapboxSceneSync(map, mapboxSceneData);
  useMapboxThreeboxModels(map);
  useMapboxPreviewInteractionLock(map);

  return (
    <>
      <MapboxBuildingInteractionHandler map={map} />
      <MapboxObservationPointHandler />
      <MapboxCameraCaptureHandler map={map} />
      <MapboxCameraSpringController map={map} />
    </>
  );
}
