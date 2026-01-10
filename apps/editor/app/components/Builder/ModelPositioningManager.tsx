"use client";

import React, { useEffect, useRef } from "react";
import { useSceneStore, useWorldStore } from "@klorad/core";
import ModelPositioningOverlay from "./ModelPositioningOverlay";
import { setupCesiumClickSelector } from "@klorad/engine-cesium";

interface PendingModel {
  name: string;
  url: string;
  type: string;
  fileType?: string;
  assetId?: string;
}

interface ModelPositioningManagerProps {
  selectingPosition: boolean;
  selectedPosition: [number, number, number] | null;
  pendingModel: PendingModel | null;
  repositioningObjectId?: string | null;
  onPositionSelected: (position: [number, number, number]) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

const ModelPositioningManager: React.FC<ModelPositioningManagerProps> = ({
  selectingPosition,
  selectedPosition,
  pendingModel,
  repositioningObjectId,
  onPositionSelected,
  onConfirm,
  onCancel,
}) => {
  const { engine } = useWorldStore();
  const setSelectingPosition = useSceneStore((s) => s.setSelectingPosition);
  const setOnPositionSelected = useSceneStore((s) => s.setOnPositionSelected);
  // Use individual selectors to avoid object reference issues
  const viewMode = useSceneStore((s) => s.viewMode);
  const cesiumViewer = useSceneStore((s) => s.cesiumViewer);

  // Use ref to store the callback to avoid dependency issues
  const onPositionSelectedRef = useRef(onPositionSelected);
  useEffect(() => {
    onPositionSelectedRef.current = onPositionSelected;
  }, [onPositionSelected]);

  useEffect(() => {
    // For Three.js, the ModelPositioningHandler inside Canvas will handle clicks
    // We just need to set the store state
    if (engine === "three") {
      setSelectingPosition(selectingPosition);
      // Always update callback when selectingPosition changes
      setOnPositionSelected(
        selectingPosition ? onPositionSelectedRef.current : null
      );
      return;
    }

    // CESIUM BRANCH
    if (engine === "cesium" && cesiumViewer) {
      const Cesium = (window as any).Cesium;
      const { camera, scene } = cesiumViewer;

      const cleanup = setupCesiumClickSelector(
        cesiumViewer,
        (screenPosition) => {
          if (!screenPosition) return;

          try {
            // Convert screen coordinates to Cartesian2
            const position = new Cesium.Cartesian2(
              screenPosition.x,
              screenPosition.y
            );

            // Try to pick a position on the globe/terrain/3D objects
            let cartesian3: any = null;

            // First, try to pick a 3D position (terrain, models, etc.)
            cartesian3 = scene.pickPosition(position);

            // If that fails, try to pick on the ellipsoid (globe surface)
            if (!Cesium.defined(cartesian3)) {
              const ray = camera.getPickRay(position);
              if (ray) {
                cartesian3 = scene.globe.pick(ray, scene);
              }
            }

            // If still no position, try the ellipsoid directly
            if (!Cesium.defined(cartesian3)) {
              cartesian3 = camera.pickEllipsoid(
                position,
                scene.globe.ellipsoid
              );
            }

            if (!Cesium.defined(cartesian3)) {
              console.warn(
                "Could not pick position - clicked on sky or invalid area"
              );
              return;
            }

            // Validate the cartesian3 position
            if (
              isNaN(cartesian3.x) ||
              isNaN(cartesian3.y) ||
              isNaN(cartesian3.z) ||
              !isFinite(cartesian3.x) ||
              !isFinite(cartesian3.y) ||
              !isFinite(cartesian3.z)
            ) {
              console.warn("Invalid cartesian3 position:", cartesian3);
              return;
            }

            // Convert cartesian3 to cartographic (lat/lon/height)
            const cartographic = Cesium.Cartographic.fromCartesian(cartesian3);

            if (!Cesium.defined(cartographic)) {
              console.warn("Failed to convert cartesian to cartographic");
              return;
            }

            const longitude = Cesium.Math.toDegrees(cartographic.longitude);
            const latitude = Cesium.Math.toDegrees(cartographic.latitude);
            const height = cartographic.height;

            // Validate the results
            if (
              isNaN(longitude) ||
              isNaN(latitude) ||
              isNaN(height) ||
              !isFinite(longitude) ||
              !isFinite(latitude) ||
              !isFinite(height)
            ) {
              console.warn("Invalid geographic coordinates:", {
                longitude,
                latitude,
                height,
              });
              return;
            }

            onPositionSelectedRef.current([longitude, latitude, height]);
          } catch (error) {
            console.error("Error converting position:", error);
          }
        }
      );

      // setupCesiumClickSelector returns a cleanup function, just call it directly
      return cleanup;
    }
  }, [
    selectingPosition,
    viewMode,
    engine,
    cesiumViewer,
    setSelectingPosition,
    setOnPositionSelected,
  ]);

  // Show overlay when either placing a new model or repositioning an existing one
  const isActive = selectingPosition && (pendingModel || repositioningObjectId);
  if (!isActive) return null;

  // Get display name: either from pending model or repositioning object
  let displayName = "";
  if (pendingModel) {
    displayName = pendingModel.name;
  } else if (repositioningObjectId) {
    // Get the object name from the scene store
    const repositioningObject = useSceneStore
      .getState()
      .objects.find((obj) => obj.id === repositioningObjectId);
    displayName = repositioningObject?.name || "Object";
  }
  const isRepositioning = !!repositioningObjectId;

  return (
    <ModelPositioningOverlay
      modelName={displayName}
      selectedPosition={selectedPosition}
      onConfirm={onConfirm}
      onCancel={onCancel}
      isRepositioning={isRepositioning}
    />
  );
};

export default ModelPositioningManager;
