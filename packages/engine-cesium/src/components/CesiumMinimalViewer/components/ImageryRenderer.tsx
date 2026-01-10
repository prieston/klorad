import { useEffect } from "react";
import { useCameraPosition } from "../hooks/useCameraPosition";
import { useCameraController } from "../hooks/useCameraController";
import type { CesiumModule } from "../types";

interface ImageryRendererProps {
  viewer: any | null;
  Cesium: CesiumModule | null;
  cesiumAssetId: string;
  enableLocationEditing: boolean;
  initialTransform?: number[];
  onTilesetReady?: (tileset: any) => void;
  onError?: (error: Error) => void;
}

/**
 * Component to handle imagery asset rendering
 */
export function ImageryRenderer({
  viewer,
  Cesium,
  cesiumAssetId,
  enableLocationEditing,
  initialTransform,
  onTilesetReady,
  onError,
}: ImageryRendererProps) {
  const { positionCamera } = useCameraPosition({ viewer, Cesium });

  // Configure camera controller
  useCameraController({
    viewer,
    enableLocationEditing,
  });

  useEffect(() => {
    if (!viewer || !Cesium || !cesiumAssetId) {
      return;
    }

    // Check if viewer is destroyed
    if (viewer.isDestroyed && viewer.isDestroyed()) {
      return;
    }

    // Check if scene exists
    if (!viewer.scene) {
      return;
    }

    const loadImagery = async () => {
      try {
        // Double-check viewer and scene are still valid
        if (!viewer || (viewer.isDestroyed && viewer.isDestroyed()) || !viewer.scene) {
          return;
        }

        // Ensure globe is visible for imagery
        if (viewer.scene.globe) {
          viewer.scene.globe.show = true;
        }

        let imageryProvider;

        // Use fromAssetId if available (async method)
        if (
          Cesium.IonImageryProvider &&
          typeof (Cesium.IonImageryProvider as any).fromAssetId === "function"
        ) {
          imageryProvider = await (
            Cesium.IonImageryProvider as any
          ).fromAssetId(parseInt(cesiumAssetId));
        } else {
          // Fallback: use constructor and wait for readyPromise
          imageryProvider = new Cesium.IonImageryProvider({
            assetId: parseInt(cesiumAssetId),
          } as any);

          // Wait for readyPromise if it exists
          if ((imageryProvider as any).readyPromise) {
            await (imageryProvider as any).readyPromise;
          } else {
            // Fallback: poll for tilingScheme
            let attempts = 0;
            while (!imageryProvider.tilingScheme && attempts < 50) {
              await new Promise((resolve) => setTimeout(resolve, 100));
              attempts++;
            }
          }
        }

        // Verify tilingScheme is available
        if (!imageryProvider.tilingScheme) {
          throw new Error(
            "Imagery provider tilingScheme not initialized after waiting"
          );
        }

        // Add provider to viewer
        viewer.imageryLayers.addImageryProvider(imageryProvider);

        // Position camera
        if (enableLocationEditing) {
          positionCamera(initialTransform);
        } else {
          // For preview mode, show a reasonable view of the globe
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(0, 0, 20000000),
            orientation: {
              heading: 0,
              pitch: Cesium.Math.toRadians(-90), // Look straight down
              roll: 0,
            },
          });
        }

        // Signal that imagery is ready (even though it's not a tileset)
        // This allows the preview dialog to know it can capture screenshots
        if (onTilesetReady) {
          // Pass null since imagery doesn't have a tileset object
          // The preview dialog checks for tilesetReady state, not the tileset itself
          onTilesetReady(null);
        }
      } catch (err) {
        console.error("[ImageryRenderer] Failed to load imagery:", err);
        if (onError) {
          onError(
            err instanceof Error
              ? err
              : new Error("Failed to load imagery asset")
          );
        }
      }
    };

    loadImagery();
  }, [
    viewer,
    Cesium,
    cesiumAssetId,
    enableLocationEditing,
    initialTransform,
    onError,
    onTilesetReady,
    positionCamera,
  ]);

  // This component doesn't render anything - it just manages Cesium state
  return null;
}
