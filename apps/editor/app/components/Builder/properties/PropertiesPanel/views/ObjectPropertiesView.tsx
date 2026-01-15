"use client";

import React, { memo, useCallback } from "react";
import { Alert, Button, Collapse } from "@mui/material";
import { useSceneStore, useWorldStore } from "@klorad/core";
import { createLogger } from "@klorad/core";
import { flyToCesiumPosition } from "@klorad/engine-cesium";
// Import from utils barrel to avoid pulling in 3d-tiles-renderer via components barrel
import { flyToThreeObject } from "@klorad/engine-three/utils";

const logger = createLogger("ObjectPropertiesView");
import { ScrollContainer } from "../components/ScrollContainer";
import ObjectActionsSection from "../../ObjectActionsSection";
import ModelInformationSection from "../../ModelInformationSection";
import ObservationModelSection from "../../ObservationModelSection";
import IoTDevicePropertiesPanel from "../../IoTDevicePropertiesPanel";
import TransformLocationSection from "../../TransformLocationSection";
import { SupportiveDataDisplay } from "../../SupportiveDataDisplay";
import { usePropertyChange } from "../hooks/usePropertyChange";
import { useGeographicCoords } from "../hooks/useGeographicCoords";

interface ObjectPropertiesViewProps {
  updateObjectProperty: (id: string, property: string, value: unknown) => void;
  repositioning?: boolean;
  onStartRepositioning?: (objectId: string) => void;
  onCancelRepositioning?: () => void;
}

// Coordinate tuple type: [longitude, latitude, altitude]
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type LonLatAlt = [lon: number, lat: number, alt: number];

// Cesium Ion asset type constants
const ION_TYPES = new Set<string>(["cesium-ion-tileset", "cesiumIonAsset"]);

/**
 * ObjectPropertiesView - Displays and edits properties for 3D models
 * Optimized with React.memo to prevent unnecessary re-renders
 */
export const ObjectPropertiesView: React.FC<ObjectPropertiesViewProps> = memo(
  ({
    updateObjectProperty,
    repositioning = false,
    onStartRepositioning,
    onCancelRepositioning,
  }) => {
    // Combine all scene store subscriptions into a single selector to reduce subscriptions from 9 to 1
    const sceneState = useSceneStore((s) => ({
      selectedObject: s.selectedObject,
      transformMode: s.transformMode,
      setTransformMode: s.setTransformMode,
      orbitControlsRef: s.orbitControlsRef,
      isCalculatingVisibility: s.isCalculatingVisibility,
      cesiumViewer: s.cesiumViewer,
      cesiumIonAssets: s.cesiumIonAssets,
      flyToCesiumIonAsset: s.flyToCesiumIonAsset,
      startVisibilityCalculation: s.startVisibilityCalculation,
    }));

    const engine = useWorldStore((s) => s.engine);

    // Destructure for cleaner lookups
    const {
      selectedObject,
      transformMode,
      setTransformMode,
      orbitControlsRef,
      isCalculatingVisibility,
      cesiumViewer,
      cesiumIonAssets,
      flyToCesiumIonAsset,
      startVisibilityCalculation,
    } = sceneState;

    const { handlePropertyChange } = usePropertyChange({
      updateObjectProperty,
    });

    const geographicCoords = useGeographicCoords(selectedObject);

    const isCesiumIonAsset = ION_TYPES.has(selectedObject?.type || "");

    const handleFlyToObject = useCallback(() => {
      // Cesium Ion asset path
      if (isCesiumIonAsset) {
        // Try to match by cesiumAssetId first (if stored in object)
        const cesiumAssetId = (selectedObject as any)?.cesiumAssetId;
        let target = null;

        if (cesiumAssetId) {
          // Match by cesiumAssetId stored in object
          target = cesiumIonAssets.find(
            (a) => String(a.assetId) === String(cesiumAssetId)
          );
        }

        // Fallback: match by name if cesiumAssetId not found
        if (!target && selectedObject?.name) {
          target = cesiumIonAssets.find(
            (a) => a.name === selectedObject.name
          );
        }

        if (target) {
          flyToCesiumIonAsset(target.id);
          return;
        }
        logger.warn("Cesium Ion asset not found:", {
          objectAssetId: selectedObject?.assetId,
          cesiumAssetId,
          objectName: selectedObject?.name,
        });
        // Fall through to position if available
      }

      if (engine === "cesium") {
        if (!cesiumViewer) {
          logger.warn("Cesium viewer not available");
          return;
        }

        // Prefer geographicCoords, fallback to object's position (LonLatAlt tuple)
        // position is [lon, lat, alt]
        const lon = geographicCoords?.longitude ?? selectedObject?.position?.[0];
        const lat = geographicCoords?.latitude ?? selectedObject?.position?.[1];
        const alt =
          geographicCoords?.altitude ?? selectedObject?.position?.[2] ?? 150;

        if ([lon, lat].every(Number.isFinite)) {
          // flyToCesiumPosition expects: (viewer, lon, lat, height)
          flyToCesiumPosition(
            cesiumViewer,
            lon as number,
            lat as number,
            alt as number
          );
        } else {
          logger.warn("No valid coordinates to fly to");
        }
        return;
      }

      // Three.js engine
      const obj = useSceneStore
        .getState()
        .objects.find((o) => o.id === selectedObject?.id);
      const modelRef = obj?.ref;
      if (modelRef && orbitControlsRef) {
        flyToThreeObject(modelRef, orbitControlsRef);
      } else {
        logger.warn("Three.js object/ref not available to fly to");
      }
    }, [
      isCesiumIonAsset,
      selectedObject?.assetId,
      selectedObject?.id,
      selectedObject?.position,
      cesiumIonAssets,
      flyToCesiumIonAsset,
      engine,
      cesiumViewer,
      geographicCoords?.longitude,
      geographicCoords?.latitude,
      geographicCoords?.altitude,
      orbitControlsRef,
    ]);

    const handleReposition = useCallback(() => {
      if (onStartRepositioning && selectedObject?.id) {
        onStartRepositioning(selectedObject.id);
      }
    }, [onStartRepositioning, selectedObject?.id]);

    const handleCalculateViewshed = useCallback(() => {
      startVisibilityCalculation(selectedObject?.id || "");
    }, [startVisibilityCalculation, selectedObject?.id]);

    const handleInteractableChange = useCallback(
      (interactable: boolean) => {
        if (selectedObject?.id) {
          updateObjectProperty(selectedObject.id, "interactable", interactable);
        }
      },
      [selectedObject?.id, updateObjectProperty]
    );

    // Get interactable value, default to true if not set
    const interactable = selectedObject?.interactable ?? true;

    // Compute if "Fly To" is possible (for future use or passing to ObjectActionsSection)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const canFlyTo =
      (engine === "cesium" &&
        !!cesiumViewer &&
        (Number.isFinite(geographicCoords?.longitude) ||
          Number.isFinite(selectedObject?.position?.[0]))) ||
      engine !== "cesium";

    return (
      <ScrollContainer>
        <ObjectActionsSection
          onFlyToObject={handleFlyToObject}
          onReposition={isCesiumIonAsset ? undefined : handleReposition}
          repositioning={repositioning}
          showGizmoControls={!isCesiumIonAsset}
          transformMode={transformMode}
          onTransformModeChange={setTransformMode}
          interactable={interactable}
          onInteractableChange={handleInteractableChange}
          engine={engine}
        />

        {repositioning && !isCesiumIonAsset && onCancelRepositioning && (
          <Alert
            severity="info"
            action={
              <Button
                color="inherit"
                size="small"
                onClick={onCancelRepositioning}
              >
                Cancel
              </Button>
            }
            sx={{ mb: 2 }}
          >
            Click anywhere in the scene to reposition the model
          </Alert>
        )}

        <ModelInformationSection
          object={selectedObject}
          onPropertyChange={handlePropertyChange}
        />

        {/* Supportive Data - only show for interactable models with assetId */}
        {interactable && selectedObject?.assetId && (
          <SupportiveDataDisplay assetId={selectedObject.assetId} />
        )}

        {/* Only show these sections for regular models, not Cesium Ion assets, and only for Cesium engine */}
        {/* Using Collapse to prevent layout shift and maintain scroll position */}
        <Collapse in={!isCesiumIonAsset && engine === "cesium"} timeout={0} unmountOnExit={false}>
          <ObservationModelSection
            object={selectedObject}
            onPropertyChange={handlePropertyChange}
            onCalculateViewshed={handleCalculateViewshed}
            isCalculating={isCalculatingVisibility}
            updateObjectProperty={updateObjectProperty}
          />

          <IoTDevicePropertiesPanel
            selectedObject={selectedObject}
            onPropertyChange={handlePropertyChange}
            geographicCoords={geographicCoords}
          />
        </Collapse>

        {/* Transform controls - always visible for both engines */}
        <TransformLocationSection
          object={selectedObject}
          geographicCoords={geographicCoords}
          onPropertyChange={handlePropertyChange}
          updateObjectProperty={updateObjectProperty}
        />
      </ScrollContainer>
    );
  }
);

ObjectPropertiesView.displayName = "ObjectPropertiesView";
