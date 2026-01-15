"use client";

import React, { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useXR, useXREvent, useXRInputSourceState } from "@react-three/xr";
import * as THREE from "three";
import { useXRStore } from "@klorad/core";
import { TeleportationArc } from "./TeleportationArc";
import {
  findGroundIntersection,
  isValidTeleportLocation,
} from "./utils/teleportationUtils";
import { useHapticFeedback } from "./hooks/useHapticFeedback";

export const TeleportationController: React.FC = () => {
  const xr = useXR();
  const left = useXRInputSourceState("controller", "left");
  const { camera, scene } = useThree();
  const raycasterRef = useRef(new THREE.Raycaster());
  const [arcEnd, setArcEnd] = useState<THREE.Vector3 | null>(null);
  const [isValid, setIsValid] = useState(false);
  const [hasIntersection, setHasIntersection] = useState(false);

  const { setTeleportTarget, setIsTeleporting, setControllerPosition } =
    useXRStore();
  const { triggerHaptic } = useHapticFeedback();

  const selectStartRef = useRef(false);
  const activeHandRef = useRef<"left" | "right" | null>(null);
  const isValidRef = useRef(false);
  const arcEndRef = useRef<THREE.Vector3 | null>(null);
  const lastArcEndRef = useRef<THREE.Vector3 | null>(null);
  const lastIsValidRef = useRef(false);
  const leftRef = useRef(left);
  const frameCountRef = useRef(0);

  // Update ref when left controller changes
  useEffect(() => {
    leftRef.current = left;
  }, [left]);

  // Handle XR select events using useXREvent (modern API)
  useXREvent("selectstart", (event: XRInputSourceEvent) => {
    const inputSource = event.inputSource;

    if (inputSource?.handedness === "left") {
      selectStartRef.current = true;
      activeHandRef.current = "left";
    }
  });

  useXREvent("selectend", (event: XRInputSourceEvent) => {
    const inputSource = event.inputSource;

    // Only process left-handed selectend events
    if (!inputSource || inputSource.handedness !== "left") return;

    // Must have started with left hand and still be valid
    if (
      selectStartRef.current &&
      activeHandRef.current === "left" &&
      isValidRef.current &&
      arcEndRef.current &&
      leftRef.current
    ) {
      // Teleport!
      setIsTeleporting(true);
      triggerHaptic(leftRef.current, "teleport");

      const hitPoint = arcEndRef.current;

      // Get camera world position
      const camWorld = new THREE.Vector3();
      camera.getWorldPosition(camWorld);

      // Calculate target position (keep head height, teleport on XZ only)
      const target = hitPoint.clone();
      target.y = camWorld.y;

      // Calculate delta to move rig
      const delta = new THREE.Vector3().subVectors(target, camWorld);

      // Validate delta before applying
      if (
        !delta.isFinite() ||
        delta.length() > 50 ||
        delta.length() < 0.1
      ) {
        if (process.env.NODE_ENV === "development") {
          console.warn("Invalid teleportation delta:", delta.length());
        }
        setIsTeleporting(false);
        return;
      }

      try {
        // Use proper rig hierarchy
        const player = (xr as any).player;
        if (player) {
          // Use player rig if available (preferred)
          player.position.add(delta);
        } else if (camera.parent) {
          // Fallback to camera parent
          camera.parent.position.add(delta);
        } else {
          // Last resort: move camera directly (not ideal but works)
          camera.position.add(delta);
        }

        // Reset teleporting state after a short delay
        setTimeout(() => {
          setIsTeleporting(false);
        }, 100);
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("Teleportation failed:", error);
        }
        setIsTeleporting(false);
      }
    }

    // Reset selection state
    selectStartRef.current = false;
    activeHandRef.current = null;
  });

  // Store controller position for arc rendering - updated every frame
  const controllerWorldPosRef = useRef(new THREE.Vector3());

  useFrame(() => {
    // Gate on controller object existence, not session
    const leftObj = left?.object;
    if (!leftObj) {
      return;
    }

    try {
      // Update controller position
      leftObj.getWorldPosition(controllerWorldPosRef.current);
      
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
        setControllerPosition("left", controllerWorldPosRef.current);
      }

      // Get controller forward direction in world space
      const worldQuaternion = new THREE.Quaternion();
      leftObj.getWorldQuaternion(worldQuaternion);
      const forward = new THREE.Vector3(0, 0, -1);
      forward.applyQuaternion(worldQuaternion);

    // Calculate pitch angle (vertical angle from horizontal)
    // Inverted: asin(forward.y) gives us +90° (up) to -90° (down)
    // We want: pointing up → far, pointing down → near
    const pitchAngle = Math.asin(forward.y);

    // Map pitch to distance using sine function
    // Pointing up (+90°) → 20m (far)
    // Pointing horizontal (0°) → 10m (mid)
    // Pointing down (-90°) → 0m (near user)
    // Formula: distance = 10 + 10 * sin(pitchAngle)
    // This ensures: up = far, horizontal = mid, down = near
    const distance = 10 + 10 * Math.sin(pitchAngle);

    // Clamp distance between 0m and 20m
    const clampedDistance = Math.max(0, Math.min(20, distance));

    // Raycast forward from controller with angle-based distance
    const startPos = controllerWorldPosRef.current.clone();

    raycasterRef.current.set(startPos, forward);
    raycasterRef.current.far = clampedDistance;

      // Find ground intersection
      const groundHit = findGroundIntersection(
        raycasterRef.current,
        scene,
        clampedDistance
      );

      // ALWAYS set an end point for visual feedback
      let endPoint: THREE.Vector3 | null = null;
      let valid = false;
      let intersectionFound = false;

      if (groundHit) {
        // Validate hit point
        if (!groundHit.point.isFinite()) {
          if (process.env.NODE_ENV === "development") {
            console.warn("Invalid ground hit point detected");
          }
          return;
        }

        // Use the actual hit point (preserve elevation for platforms, stairs, etc.)
        endPoint = groundHit.point.clone();
        intersectionFound = true;

      valid = isValidTeleportLocation(
        endPoint,
        groundHit.normal,
        groundHit.hitObject,
        startPos
      );
      } else {
        // No ground hit - project forward for visual feedback only
        // Don't mark as valid (can't teleport to nothing)
        endPoint = startPos
          .clone()
          .add(forward.clone().multiplyScalar(clampedDistance));
        intersectionFound = false;
        valid = false;
      }

      // Validate endPoint before using
      if (endPoint && !endPoint.isFinite()) {
        if (process.env.NODE_ENV === "development") {
          console.warn("Invalid end point calculated");
        }
        return;
      }

      // Only update React state when values change meaningfully
      isValidRef.current = valid;
      arcEndRef.current = endPoint;

      if (!lastArcEndRef.current || !endPoint.equals(lastArcEndRef.current)) {
        setArcEnd(endPoint);
        lastArcEndRef.current = endPoint.clone();
      }

      if (lastIsValidRef.current !== valid) {
        setIsValid(valid);
        lastIsValidRef.current = valid;
      }

      // Update intersection state
      setHasIntersection(intersectionFound);

      setTeleportTarget(valid ? endPoint : null);
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Error in teleportation frame update:", error);
      }
    }
  });

  // Only render if we have a controller object
  const leftObj = left?.object;
  if (!leftObj) {
    return null;
  }

  return (
    <TeleportationArc
      start={controllerWorldPosRef.current}
      end={arcEnd}
      isValid={isValid}
      hasIntersection={hasIntersection}
    />
  );
};
