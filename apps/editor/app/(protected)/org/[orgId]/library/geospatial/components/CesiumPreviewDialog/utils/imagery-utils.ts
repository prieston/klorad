import type { Asset } from "@/app/utils/api";

/**
 * Detect what imagery is currently loaded in the Cesium viewer
 * @param viewer - Cesium viewer instance
 * @param imageryAssets - List of available imagery assets
 * @returns The ID of the matching asset, or null if none found
 */
export async function detectLoadedImagery(
  viewer: any,
  imageryAssets: Asset[]
): Promise<string | null> {
  if (!viewer || !imageryAssets.length) {
    return null;
  }

  try {
    const Cesium = await import("cesium");
    const imageryLayers = viewer.imageryLayers;

    // Check each imagery layer
    for (let i = 0; i < imageryLayers.length; i++) {
      const layer = imageryLayers.get(i);
      if (layer?.imageryProvider) {
        const provider = layer.imageryProvider;

        // Check if it's an IonImageryProvider
        if (provider instanceof Cesium.IonImageryProvider) {
          const assetId = (provider as any).assetId;
          if (assetId) {
            // Find matching asset in imageryAssets
            const matchingAsset = imageryAssets.find(
              (asset: Asset) =>
                String(asset.cesiumAssetId) === String(assetId)
            );
            if (matchingAsset) {
              return matchingAsset.id;
            }
          }
        }
      }
    }
  } catch (err) {
    console.error(
      "[CesiumPreviewDialog] Error detecting loaded imagery:",
      err
    );
  }

  return null;
}
