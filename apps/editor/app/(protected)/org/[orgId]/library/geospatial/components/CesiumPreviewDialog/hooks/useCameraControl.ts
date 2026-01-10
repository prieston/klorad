import React from "react";

interface UseCameraControlProps {
  viewerRef: React.MutableRefObject<any>;
  tilesetRef: React.MutableRefObject<any>;
  assetType?: string;
}

/**
 * Hook to handle camera reset/zoom functionality
 */
export function useCameraControl({
  viewerRef,
  tilesetRef,
  assetType,
}: UseCameraControlProps) {
  const handleResetZoom = async () => {
    if (!viewerRef.current) return;

    try {
      const Cesium = await import("cesium");

      // For terrain assets, fly to a default globe view
      if (assetType === "TERRAIN") {
        viewerRef.current.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(0, 0, 20000000),
          orientation: {
            heading: 0,
            pitch: Cesium.Math.toRadians(-90), // Look straight down
            roll: 0,
          },
        });
        return;
      }

      // For other asset types, zoom to tileset
      if (!tilesetRef.current) return;

      // Use zoomTo for all cases
      viewerRef.current.zoomTo(
        tilesetRef.current,
        new Cesium.HeadingPitchRange(0, -0.5, 0)
      );
    } catch (err) {
      console.warn("Error resetting zoom:", err);
      // Fallback: try zoomTo without options
      try {
        if (viewerRef.current && tilesetRef.current) {
          viewerRef.current.zoomTo(tilesetRef.current);
        }
      } catch (fallbackErr) {
        console.error("Error in fallback zoom:", fallbackErr);
      }
    }
  };

  return { handleResetZoom };
}
