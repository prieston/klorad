"use client";

import { useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useXR, useXREvent, useXRInputSourceState } from "@react-three/xr";
import * as THREE from "three";
import { useXRStore, useSceneStore } from "@klorad/core";
import type { Model } from "@klorad/core/src/state/scene-store/types";
import { InteractionRay } from "./InteractionRay";
import { findInteractableModel } from "./utils/interactionUtils";
import { useHapticFeedback } from "./hooks/useHapticFeedback";

export const InteractionController: React.FC = () => {
  const xr = useXR();
  const right = useXRInputSourceState("controller", "right");
  const { scene } = useThree();
  const raycasterRef = useRef(new THREE.Raycaster());
  const [hitPoint, setHitPoint] = useState<THREE.Vector3 | null>(null);
  const [isInteractable, setIsInteractable] = useState(false);
  const [hasIntersection, setHasIntersection] = useState(false);
  const forwardRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, -1));

  const objects = useSceneStore((state) => state.objects);
  const {
    setHoveredModelId,
    setSelectedModelId,
    setOpenContainerId,
    setControllerPosition,
    hoveredModelId,
  } = useXRStore();
  const { triggerHaptic } = useHapticFeedback();

  const lastHoveredIdRef = useRef<string | null>(null);
  const currentHoveredModelRef = useRef<{
    model: Model;
    hitPoint: THREE.Vector3;
  } | null>(null);
  const lastHitPointRef = useRef<THREE.Vector3 | null>(null);
  const lastIsInteractableRef = useRef(false);
  const frameCountRef = useRef(0);

  // Handle select events using useXREvent (modern API)
  useXREvent("selectend", (event: XRInputSourceEvent) => {
    const inputSource = event.inputSource;

    if (
      inputSource?.handedness === "right" &&
      currentHoveredModelRef.current
    ) {
      const result = currentHoveredModelRef.current;

      // Trigger haptic feedback
      if (right) {
        triggerHaptic(right, "select");
      }

      // Get fresh state to avoid stale closure
      const currentState = useXRStore.getState();
      const currentOpenContainerId = currentState.openContainerId;

      // Toggle container: if same model, close it; otherwise open new one
      if (currentOpenContainerId === result.model.id) {
        setOpenContainerId(null);
        setSelectedModelId(null);
      } else {
        setSelectedModelId(result.model.id);
        setOpenContainerId(result.model.id);
      }
    }
  });

  const controllerWorldPosRef = useRef(new THREE.Vector3());

  useFrame(() => {
    // Gate on controller object existence, not session
    const rightObj = right?.object;
    if (!rightObj) return;

    try {
      // Update controller position
      rightObj.getWorldPosition(controllerWorldPosRef.current);
      
      // Validate position before using
      if (!controllerWorldPosRef.current.isFinite()) {
        if (process.env.NODE_ENV === "development") {
          console.warn("Invalid controller position detected");
        }
        return;
      }

      // Throttle controller position updates (every 3 frames for performance)
      frameCountRef.current++;
      if (frameCountRef.current % 3 === 0) {
        setControllerPosition("right", controllerWorldPosRef.current);
      }

      // Get controller forward direction in world space
      const worldQuaternion = new THREE.Quaternion();
      rightObj.getWorldQuaternion(worldQuaternion);
      const forward = new THREE.Vector3(0, 0, -1);
      forward.applyQuaternion(worldQuaternion);
      forwardRef.current = forward;

      // Raycast forward from controller
      raycasterRef.current.set(controllerWorldPosRef.current, forward);
      raycasterRef.current.far = 20; // Interaction range

      // Find interactable model with occlusion support (optimized raycasting)
      const interactableResult = findInteractableModel(
        raycasterRef.current,
        objects,
        scene
      );

      let hitPoint: THREE.Vector3 | null = null;
      let hasIntersection = false;

      if (interactableResult) {
        // Validate intersection point
        if (!interactableResult.hitPoint.isFinite()) {
          if (process.env.NODE_ENV === "development") {
            console.warn("Invalid intersection point detected");
          }
          return;
        }

        // Use the hit point from interactable result
        hitPoint = interactableResult.hitPoint;
        hasIntersection = true;
      } else {
        // No interactable hit - project a point forward for visual feedback (straight line)
        hitPoint = controllerWorldPosRef.current
          .clone()
          .add(forward.clone().multiplyScalar(20));
        hasIntersection = false;
      }

      // Validate hitPoint before using
      if (hitPoint && !hitPoint.isFinite()) {
        if (process.env.NODE_ENV === "development") {
          console.warn("Invalid hit point calculated");
        }
        return;
      }

      // ALWAYS set a hit point for visual feedback
      if (hitPoint) {
        // Only update React state when hit point changes meaningfully
        if (
          !lastHitPointRef.current ||
          !hitPoint.equals(lastHitPointRef.current)
        ) {
          setHitPoint(hitPoint);
          lastHitPointRef.current = hitPoint.clone();
        }

        // Update interactable state
        if (interactableResult) {
          currentHoveredModelRef.current = interactableResult;

          if (!lastIsInteractableRef.current) {
            setIsInteractable(true);
            lastIsInteractableRef.current = true;
          }

          // Update hovered model
          if (interactableResult.model.id !== hoveredModelId) {
            setHoveredModelId(interactableResult.model.id);

            // Trigger haptic feedback on hover
            if (interactableResult.model.id !== lastHoveredIdRef.current) {
              triggerHaptic(right, "hover");
              lastHoveredIdRef.current = interactableResult.model.id;
            }
          }
        } else {
          if (lastIsInteractableRef.current) {
            setIsInteractable(false);
            lastIsInteractableRef.current = false;
          }

          setHoveredModelId(null);
          lastHoveredIdRef.current = null;
          currentHoveredModelRef.current = null;
        }
      }

      // Update intersection state
      setHasIntersection(hasIntersection);
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Error in interaction frame update:", error);
      }
    }
  });

  // Only render if we have a controller object
  const rightObj = right?.object;
  if (!rightObj) {
    return null;
  }

  return (
    <InteractionRay
      start={controllerWorldPosRef.current}
      end={hitPoint}
      isInteractable={isInteractable}
      hasIntersection={hasIntersection}
      forward={forwardRef.current}
    />
  );
};
