"use client";

import { useEffect, useRef, useCallback } from "react";
import { Cartesian3 } from "@cesium/engine";
import { extractHPRFromTransform } from "../utils/transform-utils";
import { matrix4ToArray } from "@klorad/engine-cesium";

interface TilesetGizmoProps {
  viewer: any;
  tileset: any;
  Cesium: any;
  currentTransform: number[] | undefined;
  currentLocation: {
    longitude: number;
    latitude: number;
    height: number;
  } | null;
  onTransformChange: (
    transform: number[],
    location: { longitude: number; latitude: number; height: number }
  ) => void;
  transformMode: "translate" | "rotate";
  enabled: boolean;
}

export function TilesetGizmo({
  viewer,
  tileset,
  Cesium,
  currentTransform,
  currentLocation,
  onTransformChange,
  transformMode,
  enabled,
}: TilesetGizmoProps) {
  const transformEditorRef = useRef<any>(null);
  const suppressChangeRef = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isInitializingRef = useRef(false); // Track if initialization is in progress
  const lastKnownPositionRef = useRef<any>(null); // Track last known position to update change detection
  const lastKnownHPRRef = useRef<any>(null); // Track last known HPR to update change detection
  // Store refs to prevent effect from re-running when props change
  const viewerRef = useRef(viewer);
  const tilesetRef = useRef(tileset);
  const cesiumRef = useRef(Cesium);

  // Update refs when props change
  useEffect(() => {
    viewerRef.current = viewer;
    tilesetRef.current = tileset;
    cesiumRef.current = Cesium;
  }, [viewer, tileset, Cesium]);

  // Get current position and rotation from transform
  const getCurrentPose = useCallback(() => {
    if (!currentLocation || !currentTransform || !Cesium) {
      return null;
    }

    const pos = Cesium.Cartesian3.fromDegrees(
      currentLocation.longitude,
      currentLocation.latitude,
      currentLocation.height
    );
    const hprDegrees = extractHPRFromTransform(Cesium, currentTransform);
    // Convert to radians for Cesium HeadingPitchRoll
    const hpr = new Cesium.HeadingPitchRoll(
      Cesium.Math.toRadians(hprDegrees.heading),
      Cesium.Math.toRadians(hprDegrees.pitch),
      Cesium.Math.toRadians(hprDegrees.roll)
    );
    return { pos, hpr };
  }, [currentLocation, currentTransform, Cesium]);

  // Handle transform changes from gizmo
  const handleTransformChange = useCallback(
    (trs: {
      translation?: Cartesian3;
      rotation?: [number, number, number];
    }) => {
      if (!viewer || !tileset || !Cesium || suppressChangeRef.current) {
        return;
      }

      const pose = getCurrentPose();
      if (!pose) return;

      const nextPos =
        trs?.translation instanceof Cesium.Cartesian3
          ? trs.translation
          : pose.pos;

      // Handle rotation - trs.rotation is in radians from TransformEditor
      const [h, p, r] = Array.isArray(trs?.rotation)
        ? trs.rotation
        : [pose.hpr.heading, pose.hpr.pitch, pose.hpr.roll];

      const nextHPR = new Cesium.HeadingPitchRoll(h, p, r);

      // Create transform matrix
      const transformMatrix = Cesium.Transforms.headingPitchRollToFixedFrame(
        nextPos,
        nextHPR,
        Cesium.Ellipsoid.WGS84
      );

      // Apply to tileset
      tileset.modelMatrix = transformMatrix;

      // Extract location
      const cartographic = Cesium.Cartographic.fromCartesian(nextPos);
      const location = {
        longitude: Cesium.Math.toDegrees(cartographic.longitude),
        latitude: Cesium.Math.toDegrees(cartographic.latitude),
        height: cartographic.height,
      };

      // Convert matrix to array
      const matrixArray = matrix4ToArray(transformMatrix);

      // Notify parent
      onTransformChange(matrixArray, location);

      // Request render
      if (viewer && !viewer.isDestroyed()) {
        viewer.scene.requestRender();
      }
    },
    [viewer, tileset, Cesium, getCurrentPose, onTransformChange]
  );

  // Cleanup when disabled
  useEffect(() => {
    if (enabled) return;

    if (transformEditorRef.current) {
      try {
        transformEditorRef.current.destroy();
        if ((transformEditorRef.current as any)._container) {
          document.body.removeChild(
            (transformEditorRef.current as any)._container
          );
        }
      } catch {
        // Ignore cleanup errors
      }
      transformEditorRef.current = null;
    }
    if (containerRef.current && containerRef.current.parentNode) {
      containerRef.current.parentNode.removeChild(containerRef.current);
      containerRef.current = null;
    }
  }, [enabled]);

  // Initialize transform editor - only once when enabled
  useEffect(() => {
    const currentViewer = viewerRef.current;
    const currentTileset = tilesetRef.current;
    const currentCesium = cesiumRef.current;

    // If editor already exists, don't re-initialize
    if (transformEditorRef.current) {
      return;
    }

    if (
      !enabled ||
      !currentViewer ||
      !currentTileset ||
      !currentCesium ||
      isInitializingRef.current
    ) {
      return;
    }

    // Mark as initializing to prevent re-runs
    isInitializingRef.current = true;

    const pose = getCurrentPose();
    if (!pose) {
      isInitializingRef.current = false;
      return;
    }

    let cancelled = false;
    let animationId: number | null = null;

    // Cleanup previous if exists
    if (transformEditorRef.current) {
      try {
        transformEditorRef.current.destroy();
        if ((transformEditorRef.current as any)._container) {
          document.body.removeChild(
            (transformEditorRef.current as any)._container
          );
        }
      } catch {
        // Ignore cleanup errors
      }
      transformEditorRef.current = null;
    }

    // Create container for transform editor
    const container = document.createElement("div");
    container.style.display = "none";
    document.body.appendChild(container);
    containerRef.current = container;

    // Create transform frame
    const transform = currentCesium.Transforms.eastNorthUpToFixedFrame(
      pose.pos,
      currentCesium.Ellipsoid.WGS84
    );

    // Create bounding sphere
    const boundingSphere = new currentCesium.BoundingSphere(pose.pos, 50.0);

    // Load TransformEditor dynamically
    (async () => {
      try {
        const { getIonSDKModules } = await import("@klorad/ion-sdk");
        const { TransformEditor: TransformEditorClass } =
          await getIonSDKModules();

        if (cancelled) return;

        // Create the TransformEditor
        const transformEditor: any = new (TransformEditorClass as any)({
          container: container,
          scene: currentViewer.scene,
          transform: transform,
          boundingSphere: boundingSphere,
          pixelSize: 100,
          maximumSizeInMeters: 50.0,
        });

        // Set initial position and rotation
        transformEditor.viewModel.position = pose.pos;
        transformEditor.viewModel.headingPitchRoll =
          new currentCesium.HeadingPitchRoll(
            pose.hpr.heading,
            pose.hpr.pitch,
            pose.hpr.roll
          );

        // Set up change detection - use refs so we can update them from outside
        lastKnownPositionRef.current = pose.pos.clone();
        lastKnownHPRRef.current = new currentCesium.HeadingPitchRoll(
          pose.hpr.heading,
          pose.hpr.pitch,
          pose.hpr.roll
        );

        const checkForChanges = () => {
          if (cancelled) return;

          if (suppressChangeRef.current) {
            if (animationId !== null) {
              cancelAnimationFrame(animationId);
            }
            animationId = requestAnimationFrame(checkForChanges);
            return;
          }

          if (transformEditor.viewModel.active) {
            const newPosition = transformEditor.viewModel.position;
            const newHPR = transformEditor.viewModel.headingPitchRoll;

            // Use refs for comparison so we can update them from outside
            const lastPosition = lastKnownPositionRef.current;
            const lastHPR = lastKnownHPRRef.current;

            // Check for position changes
            if (
              newPosition &&
              lastPosition &&
              !currentCesium.Cartesian3.equals(newPosition, lastPosition)
            ) {
              handleTransformChange({
                translation: newPosition,
                rotation: [newHPR.heading, newHPR.pitch, newHPR.roll], // Already in radians
              });
              lastKnownPositionRef.current = newPosition.clone();
            }

            // Check for rotation changes
            if (
              newHPR &&
              lastHPR &&
              !currentCesium.HeadingPitchRoll.equals(newHPR, lastHPR)
            ) {
              handleTransformChange({
                translation: newPosition || lastPosition,
                rotation: [newHPR.heading, newHPR.pitch, newHPR.roll], // Already in radians
              });
              lastKnownHPRRef.current = newHPR.clone();
            }
          }

          if (!cancelled) {
            if (animationId !== null) {
              cancelAnimationFrame(animationId);
            }
            animationId = requestAnimationFrame(checkForChanges);
          }
        };

        // Start checking for changes
        checkForChanges();

        // Set initial mode
        if (transformMode === "translate") {
          transformEditor.viewModel.setModeTranslation();
        } else {
          transformEditor.viewModel.setModeRotation();
        }

        transformEditor.viewModel.activate();

        // Store container reference for cleanup
        (transformEditor as any)._container = container;

        transformEditorRef.current = transformEditor;
        isInitializingRef.current = false; // Clear initialization flag

        // Force initial render
        currentViewer.scene.requestRender();
      } catch (error) {
        console.error("[TilesetGizmo] Failed to load TransformEditor:", error);
        isInitializingRef.current = false; // Reset on error
      }
    })();

    return () => {
      cancelled = true;
      if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
      if (transformEditorRef.current) {
        try {
          transformEditorRef.current.destroy();
          if ((transformEditorRef.current as any)._container) {
            document.body.removeChild(
              (transformEditorRef.current as any)._container
            );
          }
        } catch {
          // Ignore cleanup errors
        }
        transformEditorRef.current = null;
      }
      if (containerRef.current && containerRef.current.parentNode) {
        containerRef.current.parentNode.removeChild(containerRef.current);
        containerRef.current = null;
      }
      isInitializingRef.current = false; // Reset initialization flag on cleanup
      // Don't reset isInitialized here - let it be managed by the enabled effect
    };
  }, [enabled]); // Only depend on enabled - don't include isInitialized to prevent cleanup when it changes

  // Update gizmo position when location/transform changes externally
  useEffect(() => {
    if (!transformEditorRef.current || !enabled) {
      return;
    }

    // Don't update if gizmo is currently being manipulated
    if (transformEditorRef.current.viewModel.active) {
      return;
    }

    const pose = getCurrentPose();
    if (!pose) {
      return;
    }

    // Update existing gizmo position (suppress echo back into polling loop)
    const currentCesium = cesiumRef.current;
    if (!currentCesium) return;

    suppressChangeRef.current = true;
    transformEditorRef.current.viewModel.position = pose.pos;
    const newHPR = new currentCesium.HeadingPitchRoll(
      pose.hpr.heading,
      pose.hpr.pitch,
      pose.hpr.roll
    );
    transformEditorRef.current.viewModel.headingPitchRoll = newHPR;

    // Update last known values so change detection doesn't see this as a change
    lastKnownPositionRef.current = pose.pos.clone();
    lastKnownHPRRef.current = newHPR.clone();

    // Allow polling again after a short delay to ensure the update is complete
    const suppressRafId = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        suppressChangeRef.current = false;
      });
    });

    return () => {
      cancelAnimationFrame(suppressRafId);
    };
  }, [
    currentLocation?.longitude,
    currentLocation?.latitude,
    currentLocation?.height,
    currentTransform,
    enabled,
  ]); // Only depend on primitive values, not objects or callbacks

  // Update gizmo mode when transform mode changes
  useEffect(() => {
    if (!transformEditorRef.current || !enabled) {
      return;
    }

    // Temporarily deactivate to ensure clean mode switch
    transformEditorRef.current.viewModel.deactivate();

    // Small delay to ensure deactivation takes effect
    setTimeout(() => {
      if (!transformEditorRef.current) return;

      if (transformMode === "translate") {
        transformEditorRef.current.viewModel.setModeTranslation();
      } else {
        transformEditorRef.current.viewModel.setModeRotation();
      }

      // Reactivate with new mode
      transformEditorRef.current.viewModel.activate();

      // Force immediate re-render to show the mode change
      const currentViewer = viewerRef.current;
      if (currentViewer && !currentViewer.isDestroyed()) {
        currentViewer.scene.requestRender();

        // Also force a re-render after a short delay to ensure it takes effect
        setTimeout(() => {
          if (currentViewer && !currentViewer.isDestroyed()) {
            currentViewer.scene.requestRender();
          }
        }, 10);
      }
    }, 5); // Very short delay to ensure deactivation completes
  }, [transformMode, enabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (transformEditorRef.current) {
        try {
          transformEditorRef.current.destroy();
        } catch {
          // Ignore cleanup errors
        }
        transformEditorRef.current = null;
      }
      if (containerRef.current && containerRef.current.parentNode) {
        containerRef.current.parentNode.removeChild(containerRef.current);
        containerRef.current = null;
      }
    };
  }, []);

  return null;
}
