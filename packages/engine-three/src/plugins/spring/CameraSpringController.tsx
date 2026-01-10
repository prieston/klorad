"use client";

import React, { useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useSpring } from "@react-spring/three";
import { useSceneStore, geographicToLocal } from "@klorad/core";

type Vector3Tuple = [number, number, number];

const CameraSpringController: React.FC = () => {
  const { camera } = useThree();
  // Combine all scene store subscriptions into a single selector to reduce subscriptions from 6 to 1
  const sceneState = useSceneStore((state) => ({
    previewMode: state.previewMode,
    previewIndex: state.previewIndex,
    observationPoints: state.observationPoints,
    capturingPOV: state.capturingPOV,
    viewMode: state.viewMode,
    orbitControlsRef: state.orbitControlsRef,
    tilesRenderer: state.tilesRenderer,
  }));

  // Destructure for cleaner lookups
  const {
    previewMode,
    previewIndex,
    observationPoints,
    capturingPOV,
    viewMode,
    orbitControlsRef,
    tilesRenderer,
  } = sceneState;

  const [spring, api] = useSpring(() => ({
    cameraPosition: camera.position.toArray() as Vector3Tuple,
    target: [0, 0, 0] as Vector3Tuple,
    config: {
      mass: 1.2, // Slightly reduced mass for more responsive movement
      tension: 150, // Increased tension for faster movement
      friction: 25, // Reduced friction for quicker response
      precision: 0.001, // Maintain precision for smooth interpolation
    },
  }));

  // Update spring target when orbitControlsRef becomes available
  useEffect(() => {
    if (orbitControlsRef) {
      api.start({
        target: orbitControlsRef.target.toArray() as Vector3Tuple,
      });
    }
  }, [orbitControlsRef, api]);

  // Only animate when in preview mode and not capturing POV
  useEffect(() => {
    if (previewMode && observationPoints.length > 0 && !capturingPOV) {
      const currentPoint = observationPoints[previewIndex];

      if (currentPoint && currentPoint.position && currentPoint.target) {
        // Ensure we have valid arrays for position and target
        const positionArray = Array.isArray(currentPoint.position)
          ? (currentPoint.position as Vector3Tuple)
          : ([0, 0, 0] as Vector3Tuple);
        const targetArray = Array.isArray(currentPoint.target)
          ? (currentPoint.target as Vector3Tuple)
          : ([0, 0, 0] as Vector3Tuple);

        // Convert coordinates: if tilesRenderer exists, coordinates are geographic [lat, lon, alt]
        // Otherwise, they're local [x, y, z]
        let position: Vector3Tuple;
        let target: Vector3Tuple;

        if (tilesRenderer) {
          // Coordinates are geographic: [latitude, longitude, altitude]
          const [lat, lon, alt] = positionArray;
          const [targetLat, targetLon, targetAlt] = targetArray;

          // Convert geographic to local coordinates
          const localPos = geographicToLocal(tilesRenderer, lat, lon, alt);
          const localTarget = geographicToLocal(tilesRenderer, targetLat, targetLon, targetAlt);

          position = [localPos.x, localPos.y, localPos.z];
          target = [localTarget.x, localTarget.y, localTarget.z];
        } else {
          // Coordinates are already local: [x, y, z]
          position = positionArray;
          target = targetArray;
        }

        // Start the camera transition
        api.start({
          cameraPosition: position,
          target: target,
          config: {
            mass: 1.2,
            tension: 150,
            friction: 25,
            precision: 0.001,
          },
        });

        // Update orbit controls target and disable controls during animation
        if (viewMode === "orbit" && orbitControlsRef) {
          // orbitControlsRef is the OrbitControls object directly (not a ref)
          const controls = orbitControlsRef as any;
          if (controls.target) {
            controls.target.set(...target);
            controls.update();
            // Disable controls during animation to prevent interference
            controls.enabled = false;
          }
        }
      }
    } else if (capturingPOV) {
      // Stop any ongoing animations when capturing POV
      api.stop();
    }
  }, [
    previewMode,
    previewIndex,
    observationPoints,
    api,
    orbitControlsRef,
    capturingPOV,
    viewMode,
    tilesRenderer,
    camera,
  ]);

  // Only update camera position in preview mode and not capturing POV
  useFrame(() => {
    if (previewMode && !capturingPOV) {
      const position = spring.cameraPosition.get() as Vector3Tuple;
      const target = spring.target.get() as Vector3Tuple;

      if (Array.isArray(position) && Array.isArray(target)) {
        camera.position.set(position[0], position[1], position[2]);
        camera.lookAt(target[0], target[1], target[2]);

        // Only update orbit controls if in orbit mode
        // orbitControlsRef is the OrbitControls object directly (not a ref)
        if (viewMode === "orbit" && orbitControlsRef) {
          const controls = orbitControlsRef as any;
          if (controls.target) {
            controls.target.set(target[0], target[1], target[2]);
            controls.update();
            // Keep controls disabled during animation
            controls.enabled = false;
          }
        }
      }
    } else if (!previewMode && viewMode === "orbit" && orbitControlsRef) {
      // Re-enable orbit controls when exiting preview mode
      const controls = orbitControlsRef as any;
      if (controls.enabled === false) {
        controls.enabled = true;
      }
    }
  });

  return null;
};

export default CameraSpringController;
