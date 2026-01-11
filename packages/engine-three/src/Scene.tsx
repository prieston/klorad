"use client";

import React, { useRef, useEffect, Suspense } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Grid, Sky } from "@react-three/drei";
import { useSceneStore } from "@klorad/core";
import * as THREE from "three";

import type { SceneProps, Model } from "./components/Scene/types";
import SceneLights from "./components/Scene/SceneLights";
import SceneObjects from "./components/Scene/SceneObjects";
import SceneObservationPoints from "./components/Scene/SceneObservationPoints";
import SceneTransformControls from "./components/Scene/SceneTransformControls";
import ModelPositioningHandler from "./components/Scene/ModelPositioningHandler";
import SceneControls from "./components/Scene/controls/SceneControls";
import Loader from "./components/Scene/Loader";
import GroundPlane from "./components/Scene/GroundPlane";
import { CesiumIonTiles, XRWrapper } from "./components";

// Create a component to handle deselection
const DeselectionHandler = () => {
  const { scene, camera, gl } = useThree();
  const deselectObject = useSceneStore((state) => state.deselectObject);

  const handleClick = (e: MouseEvent) => {
    if (e.target !== (gl as any).domElement) return;
    // Ignore right-click (button 2) and middle-click (button 1)
    if (e.button === 2 || e.button === 1) return;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const rect = (gl as any).domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera as any);

    const allObjects: any[] = [];
    (scene as any).traverse((object: any) => {
      if ((object as any).isMesh) {
        allObjects.push(object);
      }
    });

    const intersects = raycaster.intersectObjects(allObjects, true);
    if (intersects.length === 0) {
      deselectObject();
    }
  };

  useEffect(() => {
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [scene, camera, gl, deselectObject]);

  return null;
};

export default function Scene({
  initialSceneData,
  renderObservationPoints = true,
  onSceneDataChange,
  enableXR = false,
  isPublishMode = false,
}: SceneProps) {
  // Combine all scene store subscriptions into a single selector to reduce subscriptions from 17 to 1
  const sceneState = useSceneStore((state) => ({
    objects: state.objects,
    observationPoints: state.observationPoints,
    selectedObject: state.selectedObject,
    previewMode: state.previewMode,
    gridEnabled: state.gridEnabled,
    groundPlaneEnabled: state.groundPlaneEnabled,
    ambientLightIntensity: state.ambientLightIntensity,
    skyboxType: state.skyboxType,
    selectedAssetId: state.selectedAssetId,
    selectedLocation: state.selectedLocation,
    showTiles: state.showTiles,
    cesiumIonAssets: state.cesiumIonAssets,
    setObjects: state.setObjects,
    setObservationPoints: state.setObservationPoints,
    setSelectedAssetId: state.setSelectedAssetId,
    setSelectedLocation: state.setSelectedLocation,
    setCesiumIonAssets: state.setCesiumIonAssets,
  }));

  // Destructure for cleaner lookups
  const {
    objects,
    observationPoints,
    selectedObject,
    previewMode,
    gridEnabled,
    groundPlaneEnabled,
    ambientLightIntensity,
    skyboxType,
    selectedAssetId,
    selectedLocation,
    showTiles,
    cesiumIonAssets,
    setObjects,
    setObservationPoints,
    setSelectedAssetId,
    setSelectedLocation,
    setCesiumIonAssets,
  } = sceneState;

  const transformControlsRef = useRef<any>(null);

  useEffect(() => {
    if (initialSceneData) {
      setObjects(initialSceneData.objects || []);
      setObservationPoints(initialSceneData.observationPoints || []);
      setSelectedAssetId(initialSceneData.selectedAssetId || "2275207");
      setSelectedLocation(initialSceneData.selectedLocation || null);
      setCesiumIonAssets(initialSceneData.cesiumIonAssets || []);
    }
  }, [
    initialSceneData,
    setObjects,
    setObservationPoints,
    setSelectedAssetId,
    setSelectedLocation,
    setCesiumIonAssets,
  ]);

  useEffect(() => {
    if (onSceneDataChange) {
      onSceneDataChange({
        objects: objects as Model[],
        observationPoints,
        selectedAssetId,
        selectedLocation,
        cesiumIonAssets,
      });
    }
  }, [
    objects,
    observationPoints,
    selectedAssetId,
    selectedLocation,
    cesiumIonAssets,
    onSceneDataChange,
  ]);

  const canRenderTiles = showTiles && selectedLocation;

  return (
    <>
      <Canvas
        shadows
        camera={{ position: [0, 5, 10], fov: 50 }}
        gl={{ preserveDrawingBuffer: true }}
        onCreated={({ gl }) => {
          (gl as any).setClearColor?.("#000000");
          // Configure WebGL context for Meta Quest compatibility
          if (enableXR) {
            const canvas = gl.domElement;
            const context = canvas.getContext("webgl2") || canvas.getContext("webgl");
            if (context && "makeXRCompatible" in context && typeof (context as any).makeXRCompatible === "function") {
              (context as any).makeXRCompatible().catch(() => {
                // Ignore errors if XR is not available
              });
            }
          }
        }}
      >
        <XRWrapper enabled={enableXR}>
          <Suspense fallback={null}>
            <DeselectionHandler />
            <ModelPositioningHandler />
            {canRenderTiles && (
              <CesiumIonTiles
                apiKey={"" as any}
                assetId={selectedAssetId}
                latitude={selectedLocation?.latitude as number}
                longitude={selectedLocation?.longitude as number}
              />
            )}

            {skyboxType === "default" && (
              <Sky
                distance={450000}
                sunPosition={[10, 20, 10]}
                inclination={0.49}
                azimuth={0.25}
              />
            )}
            {gridEnabled && (
              <Grid
                position={[0, 0, 0]}
                args={[20, 20]}
                cellSize={1}
                cellThickness={0.5}
                sectionSize={5}
                sectionThickness={1}
                fadeDistance={100}
                sectionColor="white"
                cellColor="gray"
                renderOrder={-1}
              />
            )}
            {groundPlaneEnabled && <GroundPlane size={100000} />}

            <SceneLights ambientLightIntensity={ambientLightIntensity} />
            <SceneObjects
              objects={objects as Model[]}
              previewMode={previewMode}
              enableXR={enableXR}
              isPublishMode={isPublishMode}
            />
            <SceneObservationPoints
              points={observationPoints}
              previewMode={previewMode}
              enableXR={enableXR}
              renderObservationPoints={renderObservationPoints}
            />
            <SceneTransformControls
              selectedObject={selectedObject as Model | null}
              transformControlsRef={transformControlsRef}
            />

            <SceneControls />
          </Suspense>
        </XRWrapper>
      </Canvas>
      <Loader />
    </>
  );
}
