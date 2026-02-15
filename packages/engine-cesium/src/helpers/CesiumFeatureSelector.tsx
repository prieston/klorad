import { useEffect, useRef, useCallback } from "react";
import { useSceneStore } from "@klorad/core";

/**
 * Handles selection of Cesium 3D Tiles features to extract metadata/properties
 *
 * Features:
 * - Supports both legacy Cesium3DTileFeature and modern ModelFeature (3D Tiles 1.1)
 * - Merges metadata from per-feature properties, inherited properties, and group/content metadata tables
 * - Duck-typing instead of instanceof to avoid double-bundled Cesium issues
 * - Left-click: Select topmost feature
 * - Shift+Left-click: Drill pick through overlapping features
 * - Captures world position for UI anchoring
 * - Clears selection on empty clicks
 */
const CesiumFeatureSelector: React.FC = () => {
  // Combine all scene store subscriptions into a single selector to reduce subscriptions from 6 to 1
  const sceneState = useSceneStore((s) => ({
    cesiumViewer: s.cesiumViewer,
    cesiumInstance: s.cesiumInstance,
    previewMode: s.previewMode,
    selectedCesiumFeature: s.selectedCesiumFeature,
    setSelectedCesiumFeature: s.setSelectedCesiumFeature,
    deselectObject: s.deselectObject,
    selectingPosition: s.selectingPosition,
  }));

  // Destructure for cleaner lookups
  const {
    cesiumViewer,
    cesiumInstance,
    previewMode,
    selectedCesiumFeature,
    setSelectedCesiumFeature,
    deselectObject,
    selectingPosition,
  } = sceneState;
  const handlerRef = useRef<any>(null);
  const highlightedFeatureRef = useRef<any>(null);
  const originalColorRef = useRef<any>(null);
  // Use ref to avoid stale closure in click handler
  const selectingPositionRef = useRef(selectingPosition);
  selectingPositionRef.current = selectingPosition;

  // Helper to restore previous feature's color
  const restoreHighlight = useCallback(() => {
    if (highlightedFeatureRef.current && originalColorRef.current) {
      try {
        highlightedFeatureRef.current.color = originalColorRef.current;
      } catch {
        // Feature might no longer be valid
      }
      highlightedFeatureRef.current = null;
      originalColorRef.current = null;
    }
  }, []);

  // Helper to highlight a feature
  const highlightFeature = (feature: any) => {
    if (!cesiumInstance) return;

    try {
      // Store original color
      originalColorRef.current = feature.color
        ? cesiumInstance.Color.clone(feature.color)
        : cesiumInstance.Color.WHITE.clone();

      // Set highlight color (bright cyan/blue)
      feature.color = cesiumInstance.Color.CYAN.withAlpha(0.8);

      // Store reference to highlighted feature
      highlightedFeatureRef.current = feature;
    } catch (err) {
      console.error("Error highlighting feature:", err);
    }
  };

  useEffect(() => {
    if (!cesiumViewer || !cesiumInstance || previewMode) {
      return;
    }

    const scene = cesiumViewer.scene;
    const canvas = scene?.canvas;
    if (!canvas) return;

    // cleanup old handler
    if (handlerRef.current) {
      try {
        handlerRef.current.destroy();
      } catch {
        // Ignore cleanup errors
      }
      handlerRef.current = null;
    }

    const handler = new cesiumInstance.ScreenSpaceEventHandler(canvas);

    const isFeatureLike = (obj: any) =>
      obj &&
      typeof obj.getProperty === "function" &&
      typeof obj.getPropertyIds === "function";

    const mergeMetadata = (feature: any) => {
      const out: Record<string, any> = {};

      // Per-feature properties (old + new)
      try {
        const ids = feature.getPropertyIds?.() || [];
        for (const id of ids) {
          try {
            out[id] = feature.getProperty(id);
          } catch {
            // Skip properties that can't be read
          }
        }
      } catch {
        // Ignore top-level errors
      }

      // Inherited (3D Tiles 1.1) – sometimes holds IFC-ish fields
      const candidates = [
        "IfcGuid",
        "ElementId",
        "Category",
        "Level",
        "Family",
        "name",
        "id",
        "type",
      ];
      for (const k of candidates) {
        try {
          const v =
            feature.getProperty?.(k) ?? feature.getPropertyInherited?.(k);
          if (v !== undefined && out[k] === undefined) out[k] = v;
        } catch {
          // Skip if property doesn't exist
        }
      }

      // Group/content metadata tables (3D Tiles 1.1)
      try {
        const groupMd = feature?.content?.group?.metadata;
        const contentMd = feature?.content?.metadata;
        const addFromMd = (md: any) => {
          if (!md) return;
          const keys = md.getPropertyIds?.() || [];
          for (const k of keys) {
            try {
              const v = md.getProperty(k);
              if (v !== undefined && out[k] === undefined) out[k] = v;
            } catch {
              // Skip if property doesn't exist
            }
          }
        };
        addFromMd(groupMd);
        addFromMd(contentMd);
      } catch {
        // Ignore metadata table errors
      }

      return out;
    };

    // Primary click: pick topmost feature
    handler.setInputAction((movement: any) => {
      // Skip if repositioning/positioning mode is active
      if (selectingPositionRef.current) {
        return;
      }

      try {
        const picked = scene.pick(movement.position);

        if (picked && isFeatureLike(picked)) {
          const properties = mergeMetadata(picked);
          const worldPos = scene.pickPosition?.(movement.position);

          // Restore previous highlight and highlight new feature
          restoreHighlight();
          highlightFeature(picked);

          // Clear any selected scene object when selecting a Cesium feature
          deselectObject();

          setSelectedCesiumFeature({
            properties,
            worldPosition: worldPos ?? null,
          });
          return;
        }

        // Clicked empty or non-feature: clear selection and restore highlight
        restoreHighlight();
        setSelectedCesiumFeature(null);
      } catch (err) {
        console.error("[CesiumFeatureSelector] Error picking Cesium feature:", err);
        setSelectedCesiumFeature(null);
      }
    }, cesiumInstance.ScreenSpaceEventType.LEFT_CLICK);

    // Shift+click: drill pick (all features under cursor)
    handler.setInputAction(
      (movement: any) => {
        // Skip if repositioning/positioning mode is active
        if (selectingPositionRef.current) {
          return;
        }

        try {
          const pickedArray = scene.drillPick(movement.position) || [];
          const featureLikes = pickedArray.filter(isFeatureLike);

          if (featureLikes.length > 0) {
            const worldPos = scene.pickPosition?.(movement.position);
            const firstFeature = featureLikes[0];

            // Restore previous highlight and highlight new feature
            restoreHighlight();
            highlightFeature(firstFeature);

            // Clear any selected scene object when selecting a Cesium feature
            deselectObject();

            // For drill pick, show the first feature's properties (can be extended to show all)
            setSelectedCesiumFeature({
              properties: mergeMetadata(firstFeature),
              worldPosition: worldPos ?? null,
              drillPickCount: featureLikes.length,
            });
            return;
          }
          restoreHighlight();
          setSelectedCesiumFeature(null);
        } catch (err) {
          console.error("Drill pick error:", err);
          setSelectedCesiumFeature(null);
        }
      },
      cesiumInstance.ScreenSpaceEventType.LEFT_CLICK,
      cesiumInstance.KeyboardEventModifier.SHIFT
    );

    handlerRef.current = handler;

    return () => {
      // Restore highlight on cleanup
      restoreHighlight();

      if (handlerRef.current) {
        try {
          handlerRef.current.destroy();
        } catch {
          // Ignore cleanup errors
        }
        handlerRef.current = null;
      }
    };
  }, [cesiumViewer, cesiumInstance, previewMode]);

  // Watch for external deselection (e.g., Clear button) and restore highlight
  useEffect(() => {
    if (!selectedCesiumFeature) {
      restoreHighlight();
    }
    // restoreHighlight is memoized with useCallback and stable
  }, [selectedCesiumFeature]);

  return null;
};

export default CesiumFeatureSelector;
