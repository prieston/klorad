import { useEffect } from "react";
import { useCameraPosition } from "../hooks/useCameraPosition";
import { useCameraController } from "../hooks/useCameraController";
import type { CesiumModule } from "../types";

interface TerrainRendererProps {
  viewer: any | null;
  Cesium: CesiumModule | null;
  cesiumAssetId: string;
  cesiumApiKey?: string;
  enableLocationEditing: boolean;
  initialTransform?: number[];
  onTilesetReady?: (tileset: any) => void;
  onError?: (error: Error) => void;
}

/**
 * Component to handle terrain asset rendering
 * Terrain assets are loaded as terrain providers, not tilesets
 */
export function TerrainRenderer({
  viewer,
  Cesium,
  cesiumAssetId,
  cesiumApiKey,
  enableLocationEditing,
  initialTransform,
  onTilesetReady,
  onError,
}: TerrainRendererProps) {
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

    const loadTerrain = async () => {
      try {
        // Double-check viewer and scene are still valid
        if (
          !viewer ||
          (viewer.isDestroyed && viewer.isDestroyed()) ||
          !viewer.scene
        ) {
          return;
        }

        // Ensure globe is visible for terrain
        if (viewer.scene.globe) {
          viewer.scene.globe.show = true;
        }

        // Set API key before loading terrain provider (similar to CesiumIonAssetsRenderer)
        // This ensures the correct token is used for the asset
        const originalToken = Cesium.Ion.defaultAccessToken;
        if (cesiumApiKey) {
          Cesium.Ion.defaultAccessToken = cesiumApiKey;
        }

        try {
          // Load terrain provider from Cesium Ion asset ID
          const terrainProvider =
            await Cesium.CesiumTerrainProvider.fromIonAssetId(
              parseInt(cesiumAssetId),
              {
                requestVertexNormals: true,
                requestWaterMask: true,
              }
            );

          // Double-check viewer is still valid before setting terrain provider
          if (
            !viewer ||
            (viewer.isDestroyed && viewer.isDestroyed()) ||
            !viewer.scene
          ) {
            // Restore original token before returning
            Cesium.Ion.defaultAccessToken = originalToken;
            return;
          }

          // Set terrain provider
          viewer.terrainProvider = terrainProvider;

          // Enable depth testing against terrain
          if (viewer.scene.globe) {
            viewer.scene.globe.depthTestAgainstTerrain = true;
          }

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

          // Signal that terrain is ready (even though it's not a tileset)
          // This allows the preview dialog to know it can capture screenshots
          if (onTilesetReady) {
            // Pass null since terrain doesn't have a tileset object
            // The preview dialog checks for tilesetReady state, not the tileset itself
            onTilesetReady(null);
          }
        } finally {
          // Restore original token
          Cesium.Ion.defaultAccessToken = originalToken;
        }
      } catch (err) {
        console.error("[TerrainRenderer] Failed to load terrain:", err);
        if (onError) {
          onError(
            err instanceof Error
              ? err
              : new Error("Failed to load terrain asset")
          );
        }
      }
    };

    loadTerrain();
  }, [
    viewer,
    Cesium,
    cesiumAssetId,
    cesiumApiKey,
    enableLocationEditing,
    initialTransform,
    onError,
    onTilesetReady,
    positionCamera,
  ]);

  // This component doesn't render anything - it just manages Cesium state
  return null;
}
