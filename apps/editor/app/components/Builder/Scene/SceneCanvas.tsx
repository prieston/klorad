"use client";

import "@/styles/vendor/mapbox-gl.css";
import React from "react";
import dynamic from "next/dynamic";
import { useWorldStore, useSceneStore } from "@klorad/core";
import PlaybackManager from "./PlaybackManager";
import type { SceneProps } from "@klorad/engine-three";

const Scene = dynamic(() => import("@klorad/engine-three"), {
  ssr: false,
});
const CesiumViewer = dynamic(
  () => import("@klorad/engine-cesium").then(m => m.CesiumViewer),
  { ssr: false }
);
const CesiumObjectTransformEditor = dynamic(
  () =>
    import("@klorad/engine-cesium").then((m) => ({
      default: m.CesiumObjectTransformEditor,
    })),
  { ssr: false }
);
const MapboxViewer = dynamic(
  () => import("@klorad/engine-mapbox").then((m) => m.MapboxViewer),
  { ssr: false }
);
// ViewshedAnalysis is rendered within the Cesium engine viewer; do not render here to avoid duplication

interface SceneCanvasProps {
  initialSceneData: NonNullable<SceneProps["initialSceneData"]>;
  onSceneDataChange?: SceneProps["onSceneDataChange"];
  renderObservationPoints?: boolean;
}

const SceneCanvas: React.FC<SceneCanvasProps> = ({
  initialSceneData,
  onSceneDataChange,
  renderObservationPoints = true,
}) => {
  // Combine store subscriptions to reduce from 4 to 1
  const engine = useWorldStore((s) => s.engine);
  const selectedObject = useSceneStore((s) => s.selectedObject);

  return (
    <>
      {/* Playback Manager - handles automatic observation cycling */}
      <PlaybackManager />

      <div
        style={{
          width: "100%",
          height: "100%", // Takes full height of its container
          display: "flex",
          flexGrow: 1,
          overflow: "hidden",
          pointerEvents: "auto", // Allow panning and interaction with the canvas
        }}
      >
        {engine === "cesium" ? (
          <>
            <CesiumViewer />
            {selectedObject && (
              <CesiumObjectTransformEditor selectedObject={selectedObject} />
            )}
            {/* ViewshedAnalysis is handled by CesiumViewer to ensure single source of render */}
          </>
        ) : engine === "mapbox" ? (
          <MapboxViewer />
        ) : (
          <Scene
            initialSceneData={initialSceneData}
            onSceneDataChange={onSceneDataChange}
            renderObservationPoints={renderObservationPoints}
          />
        )}
      </div>
    </>
  );
};

export default SceneCanvas;
