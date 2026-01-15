"use client";

import React, { useRef, useEffect, useMemo } from "react";
import * as THREE from "three";
import { useSceneStore } from "@klorad/core";
import useModelLoader from "./hooks/useModelLoader";
import { useModelSelection } from "./hooks/useModelSelection";
import { useModelMaterials } from "./hooks/useModelMaterials";
import ObservationVisibilityArea from "./ObservationVisibilityArea";

interface ModelProps {
  id: string;
  url: string;
  type?: string;
  position?: [number, number, number];
  scale?: [number, number, number];
  rotation?: [number, number, number];
  selected?: boolean;
  onSelect?: (id: string, object: THREE.Object3D) => void;
  assetId?: string;
  isObservationModel?: boolean;
  observationProperties?: {
    sensorType: "cone" | "rectangle";
    fov: number;
    fovH?: number;
    fovV?: number;
    visibilityRadius: number;
    showSensorGeometry: boolean;
    showViewshed: boolean;
    sensorColor?: string;
    viewshedColor?: string;
    analysisQuality: "low" | "medium" | "high";
    raysAzimuth?: number;
    raysElevation?: number;
    clearance?: number;
    stepCount?: number;
    enableTransformEditor?: boolean;
    transformEditorPosition?: [number, number, number];
    transformEditorRotation?: [number, number, number];
    transformEditorScale?: [number, number, number];
  };
}

const Model = ({
  id,
  url,
  type = "glb",
  position = [0, 0, 0],
  scale = [1, 1, 1],
  rotation = [0, 0, 0],
  selected,
  onSelect,
  isObservationModel,
  observationProperties,
}: ModelProps) => {
  // Use selector to only subscribe to the specific object we need
  const objectFromStore = useSceneStore((state) =>
    state.objects.find((obj) => obj.id === id)
  );
  const effectiveObservationProperties =
    objectFromStore?.observationProperties || observationProperties;

  const modelData = useModelLoader(url, type);

  if (!modelData) {
    return null;
  }

  const originalObject = (modelData as any).scene || modelData;

  const clonedObject = useMemo(() => {
    if (originalObject) {
      const clone = originalObject.clone(true);
      clone.userData.isModel = true;
      clone.userData.modelId = id;
      clone.traverse((child: any) => {
        if (child.isMesh && child.material) {
          child.material = child.material.clone();
        }
        // Propagate modelId to all children
        child.userData.modelId = id;
      });
      return clone;
    }
    return null;
  }, [originalObject]);

  const modelRef = useRef<THREE.Object3D | null>(null);
  const previewMode = useSceneStore((state) => state.previewMode);
  const updateModelRef = useSceneStore((state) => state.updateModelRef);

  const { handlePointerDown, handlePointerUp } = useModelSelection({
    id,
    onSelect,
    previewMode,
  });

  useModelMaterials({
    modelRef,
    selected: !!selected,
    previewMode,
  });

  useEffect(() => {
    if (modelRef.current) {
      if (position) {
        modelRef.current.position.set(...position);
      }
      if (rotation) {
        modelRef.current.rotation.set(...rotation);
      }
      if (scale) {
        modelRef.current.scale.set(...scale);
      }
    }
  }, [position, rotation, scale]);

  useEffect(() => {
    if (modelRef.current) {
      updateModelRef(id, modelRef.current);
    }
  }, [id, updateModelRef]);

  if (!clonedObject) {
    return null;
  }

  return (
    <>
      <primitive
        ref={modelRef}
        object={clonedObject}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      />
      {isObservationModel && effectiveObservationProperties?.showViewshed && (
        <ObservationVisibilityArea
          position={position}
          rotation={rotation}
          fov={effectiveObservationProperties.fov}
          radius={effectiveObservationProperties.visibilityRadius}
          showVisibleArea={effectiveObservationProperties.showViewshed}
        />
      )}
    </>
  );
};

export default Model;
