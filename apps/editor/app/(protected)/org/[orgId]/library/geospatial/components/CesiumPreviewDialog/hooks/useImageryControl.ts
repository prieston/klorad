import React from "react";
import type { Asset } from "@/app/utils/api";

interface UseImageryControlProps {
  viewerRef: React.MutableRefObject<any>;
  imageryAssets: Asset[];
  currentImageryProviderRef: React.MutableRefObject<any>;
  selectedImageryAssetId: string | null;
  setSelectedImageryAssetId: (id: string | null) => void;
  onError: (error: Error) => void;
}

/**
 * Hook to handle imagery change functionality
 */
export function useImageryControl({
  viewerRef,
  imageryAssets,
  currentImageryProviderRef,
  selectedImageryAssetId: _selectedImageryAssetId,
  setSelectedImageryAssetId,
  onError,
}: UseImageryControlProps) {
  const handleImageryChange = async (assetId: string | null) => {
    if (!viewerRef.current || !viewerRef.current.scene) {
      return;
    }

    try {
      const Cesium = await import("cesium");

      // Remove all existing imagery layers (including default Cesium World Imagery)
      viewerRef.current.imageryLayers.removeAll();

      // If no asset selected, remove all imagery layers
      if (!assetId) {
        setSelectedImageryAssetId(null);
        currentImageryProviderRef.current = null;
        viewerRef.current.scene.requestRender();
        return;
      }

      // Find the selected asset
      const selectedAsset = imageryAssets.find(
        (asset: Asset) => asset.id === assetId
      );

      if (
        !selectedAsset ||
        !selectedAsset.cesiumAssetId ||
        !selectedAsset.cesiumApiKey
      ) {
        console.error(
          "[CesiumPreviewDialog] Selected asset not found or missing required fields"
        );
        return;
      }

      // Set API key before loading
      const originalToken = Cesium.Ion.defaultAccessToken;
      if (selectedAsset.cesiumApiKey) {
        Cesium.Ion.defaultAccessToken = selectedAsset.cesiumApiKey;
      }

      try {
        let imageryProvider;

        // Use fromAssetId if available (async method)
        if (
          Cesium.IonImageryProvider &&
          typeof (Cesium.IonImageryProvider as any).fromAssetId === "function"
        ) {
          imageryProvider = await (
            Cesium.IonImageryProvider as any
          ).fromAssetId(parseInt(selectedAsset.cesiumAssetId));
        } else {
          // Fallback: use constructor
          imageryProvider = new Cesium.IonImageryProvider({
            assetId: parseInt(selectedAsset.cesiumAssetId),
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
        viewerRef.current.imageryLayers.addImageryProvider(imageryProvider);
        currentImageryProviderRef.current = imageryProvider;

        // Request render
        viewerRef.current.scene.requestRender();

        setSelectedImageryAssetId(assetId);
      } finally {
        // Restore original token
        Cesium.Ion.defaultAccessToken = originalToken;
      }
    } catch (err) {
      console.error("[CesiumPreviewDialog] Error changing imagery:", err);
      onError(
        err instanceof Error ? err : new Error("Failed to change basemap")
      );
    }
  };

  return { handleImageryChange };
}
