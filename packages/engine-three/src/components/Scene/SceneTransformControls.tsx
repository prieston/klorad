"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { TransformControls } from "@react-three/drei";
import { useSceneStore } from "@klorad/core";
import * as THREE from "three";

import type { SceneTransformControlsProps } from "./types";

const SceneTransformControls: React.FC<SceneTransformControlsProps> = ({
  selectedObject,
  transformControlsRef,
}) => {
  const { transformMode, previewMode, updateObjectProperty } = useSceneStore();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const localTransformControlsRef = useRef<any>(null);
  const isDraggingRef = useRef(false);
  const suppressUpdateRef = useRef(false);

  // Update the parent ref when our local ref changes
  useEffect(() => {
    if (transformControlsRef && localTransformControlsRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (transformControlsRef as React.MutableRefObject<any>).current =
        localTransformControlsRef.current;
    }
  }, [transformControlsRef]);

  // Handle transform changes from the gizmo
  const handleChange = useCallback(() => {
    if (!selectedObject || !selectedObject.ref) return;
    if (suppressUpdateRef.current) return;

    const object = selectedObject.ref as THREE.Object3D;

    // Update store with new position, rotation, or scale
    if (object.position) {
      updateObjectProperty(selectedObject.id, "position", [
        object.position.x,
        object.position.y,
        object.position.z,
      ]);
    }

    if (object.rotation) {
      updateObjectProperty(selectedObject.id, "rotation", [
        object.rotation.x,
        object.rotation.y,
        object.rotation.z,
      ]);
    }

    if (object.scale) {
      updateObjectProperty(selectedObject.id, "scale", [
        object.scale.x,
        object.scale.y,
        object.scale.z,
      ]);
    }
  }, [selectedObject, updateObjectProperty]);

  // Sync gizmo position/rotation when object properties change externally
  useEffect(() => {
    if (!selectedObject || !localTransformControlsRef.current) return;
    if (isDraggingRef.current) return; // Don't sync while user is dragging

    const object = selectedObject.ref as THREE.Object3D | undefined;

    if (!object) return;

    // Suppress updates to prevent infinite loops
    suppressUpdateRef.current = true;

    // Sync position
    if (selectedObject.position && Array.isArray(selectedObject.position)) {
      object.position.set(
        selectedObject.position[0],
        selectedObject.position[1],
        selectedObject.position[2]
      );
    }

    // Sync rotation
    if (selectedObject.rotation && Array.isArray(selectedObject.rotation)) {
      object.rotation.set(
        selectedObject.rotation[0],
        selectedObject.rotation[1],
        selectedObject.rotation[2]
      );
    }

    // Sync scale
    if (selectedObject.scale && Array.isArray(selectedObject.scale)) {
      object.scale.set(
        selectedObject.scale[0],
        selectedObject.scale[1],
        selectedObject.scale[2]
      );
    }

    // Update object's matrix to reflect changes
    object.updateMatrixWorld();

    // Allow updates again after a frame
    requestAnimationFrame(() => {
      suppressUpdateRef.current = false;
    });
  }, [
    selectedObject,
    selectedObject?.position,
    selectedObject?.rotation,
    selectedObject?.scale,
    selectedObject?.ref,
  ]);

  // Note: TransformControls mode is controlled via the mode prop in render
  // No need for a separate useEffect to set mode

  // Don't render if no object selected, no ref, or in preview mode
  if (
    !selectedObject ||
    !selectedObject.ref ||
    previewMode ||
    !(selectedObject.ref instanceof THREE.Object3D)
  ) {
    return null;
  }

  return (
    <TransformControls
      ref={localTransformControlsRef}
      object={selectedObject.ref}
      mode={transformMode}
      space="world"
      onChange={handleChange}
    />
  );
};

export default SceneTransformControls;
