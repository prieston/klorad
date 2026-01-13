"use client";
import React from "react";
import Scene, { SceneProps } from "@klorad/engine-three";
import dynamic from "next/dynamic";
import { useWorldStore } from "@klorad/core";

const CesiumViewer = dynamic(
  () => import("@klorad/engine-cesium").then(m => m.CesiumViewer),
  { ssr: false }
);

type SceneData = NonNullable<SceneProps["initialSceneData"]>;

const PreviewScene = ({
  initialSceneData,
  renderObservationPoints = true,
  onSceneDataChange,
  enableXR = false,
  isPublishMode = false,
  projectId,
}: {
  initialSceneData: SceneData;
  renderObservationPoints?: boolean;
  onSceneDataChange?: SceneProps["onSceneDataChange"];
  enableXR?: boolean;
  isPublishMode?: boolean;
  projectId?: string;
}) => {
  const engine = useWorldStore((s) => s.engine);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexGrow: 1,
        overflow: "hidden",
      }}
    >
      {engine === "cesium" ? (
        <CesiumViewer />
      ) : (
        <Scene
          initialSceneData={initialSceneData}
          renderObservationPoints={renderObservationPoints}
          onSceneDataChange={onSceneDataChange}
          enableXR={enableXR}
          isPublishMode={isPublishMode}
          projectId={projectId}
        />
      )}
    </div>
  );
};

export default PreviewScene;
