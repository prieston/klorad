import React, { useEffect, useCallback } from "react";
import type { Asset } from "@/app/utils/api";
import { detectLoadedImagery } from "../utils/imagery-utils";

interface UseImagerySyncProps {
  open: boolean;
  assetType?: string;
  cesiumAssetId: string;
  imageryAssets: Asset[];
  viewerRef: React.MutableRefObject<any>;
  dropdownInitializedRef: React.MutableRefObject<boolean>;
  selectedImageryAssetId: string | null;
  setSelectedImageryAssetId: (id: string | null) => void;
}

/**
 * Hook to sync imagery dropdown with loaded imagery in viewer
 */
export function useImagerySync({
  open,
  assetType,
  cesiumAssetId,
  imageryAssets,
  viewerRef,
  dropdownInitializedRef,
  selectedImageryAssetId: _selectedImageryAssetId,
  setSelectedImageryAssetId,
}: UseImagerySyncProps) {
  const detectLoaded = useCallback(async (): Promise<string | null> => {
    return detectLoadedImagery(viewerRef.current, imageryAssets);
  }, [viewerRef, imageryAssets]);

  // Reset dropdown initialization flag when dialog closes
  useEffect(() => {
    if (!open) {
      dropdownInitializedRef.current = false;
    }
  }, [open, dropdownInitializedRef]);

  // Sync selectedImageryAssetId with the initial asset if it's an IMAGERY type
  useEffect(() => {
    if (!open) {
      return;
    }

    // Only initialize dropdown once per dialog session
    if (dropdownInitializedRef.current) {
      return;
    }

    // For non-IMAGERY assets, set dropdown to "None" (no basemap selected) only on initial open
    if (assetType !== "IMAGERY") {
      setSelectedImageryAssetId(null);
      dropdownInitializedRef.current = true;
      return;
    }

    // For IMAGERY assets, sync dropdown to show the current imagery asset
    if (assetType === "IMAGERY" && cesiumAssetId) {
      if (imageryAssets.length > 0) {
        // First try to match by cesiumAssetId prop
        const matchingAsset = imageryAssets.find(
          (asset: Asset) =>
            String(asset.cesiumAssetId) === String(cesiumAssetId)
        );
        if (matchingAsset) {
          setSelectedImageryAssetId(matchingAsset.id);
          dropdownInitializedRef.current = true;
        } else {
          // If no match, try to detect what's actually loaded
          // This handles cases where viewer already has imagery loaded
          if (viewerRef.current) {
            detectLoaded().then((detectedId) => {
              if (detectedId) {
                setSelectedImageryAssetId(detectedId);
              }
              dropdownInitializedRef.current = true;
            });
          } else {
            dropdownInitializedRef.current = true;
          }
        }
      } else {
        dropdownInitializedRef.current = true;
      }
    }
  }, [
    open,
    assetType,
    cesiumAssetId,
    imageryAssets,
    detectLoaded,
    viewerRef,
    dropdownInitializedRef,
    setSelectedImageryAssetId,
  ]);

  return { detectLoaded };
}
