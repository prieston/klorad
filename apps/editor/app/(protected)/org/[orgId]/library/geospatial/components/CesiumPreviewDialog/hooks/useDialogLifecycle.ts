import React, { useEffect } from "react";
import { destroyViewer, cleanupViewerDOM } from "../utils/viewer-utils";
import type { Asset } from "@/app/utils/api";

interface UseDialogLifecycleProps {
  open: boolean;
  assetType?: string;
  imageryAssets: Asset[];
  viewerRef: React.MutableRefObject<any>;
  tilesetRef: React.MutableRefObject<any>;
  containerRef: React.RefObject<HTMLDivElement>;
  originalTerrainProviderRef: React.MutableRefObject<any>;
  currentImageryProviderRef: React.MutableRefObject<any>;
  isCapturingRef: React.MutableRefObject<boolean>;
  isUploadingRef: React.MutableRefObject<boolean>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setLocationNotSet: (locationNotSet: boolean) => void;
  setTilesetReady: (ready: boolean) => void;
  setUploading: (uploading: boolean) => void;
  setCapturing: (capturing: boolean) => void;
  setShowTerrain: (show: boolean) => void;
  setSelectedImageryAssetId: (id: string | null) => void;
  selectedImageryAssetId: string | null;
  detectLoaded: () => Promise<string | null>;
}

/**
 * Hook to handle dialog lifecycle (cleanup and initialization)
 */
export function useDialogLifecycle({
  open,
  assetType,
  imageryAssets,
  viewerRef,
  tilesetRef,
  containerRef,
  originalTerrainProviderRef,
  currentImageryProviderRef,
  isCapturingRef,
  isUploadingRef,
  setLoading,
  setError,
  setLocationNotSet,
  setTilesetReady,
  setUploading,
  setCapturing,
  setShowTerrain,
  setSelectedImageryAssetId,
  selectedImageryAssetId,
  detectLoaded,
}: UseDialogLifecycleProps) {
  const handleViewerReady = async (viewer: any) => {
    viewerRef.current = viewer;
    setLoading(false);

    // If opening with an IMAGERY asset, check what's loaded after a delay
    if (assetType === "IMAGERY") {
      setTimeout(async () => {
        if (imageryAssets.length > 0) {
          const detectedAssetId = await detectLoaded();
          if (detectedAssetId && detectedAssetId !== selectedImageryAssetId) {
            setSelectedImageryAssetId(detectedAssetId);
          }
        }
      }, 1000);
    }
  };

  const handleTilesetReady = async (tileset: any) => {
    tilesetRef.current = tileset;
    setTilesetReady(true);

    // Remove any default imagery for non-IMAGERY assets
    if (viewerRef.current && assetType !== "IMAGERY") {
      try {
        const imageryLayers = viewerRef.current.imageryLayers;
        if (imageryLayers && imageryLayers.length > 0) {
          imageryLayers.removeAll();
          viewerRef.current.scene.requestRender();
        }
      } catch (err) {
        // Silently ignore - this is non-critical
      }
    }

    // For IMAGERY assets, detect what's actually loaded and sync dropdown
    if (assetType === "IMAGERY") {
      setTimeout(async () => {
        if (imageryAssets.length > 0) {
          const detectedAssetId = await detectLoaded();
          if (detectedAssetId && detectedAssetId !== selectedImageryAssetId) {
            setSelectedImageryAssetId(detectedAssetId);
          }
        }
      }, 500);
    }

    // Check terrain provider after a delay to allow it to load asynchronously
    setTimeout(async () => {
      if (viewerRef.current && viewerRef.current.terrainProvider) {
        const Cesium = await import("cesium");
        const currentProvider = viewerRef.current.terrainProvider;
        const isEllipsoid =
          currentProvider instanceof Cesium.EllipsoidTerrainProvider;

        // Only store if it's not EllipsoidTerrainProvider (which is the default)
        if (!isEllipsoid) {
          originalTerrainProviderRef.current = currentProvider;
        }
      }
    }, 500);
  };

  const handleError = (err: Error) => {
    // Don't display errors if viewer is destroyed or being cleaned up
    if (
      !viewerRef.current ||
      (viewerRef.current.isDestroyed && viewerRef.current.isDestroyed()) ||
      isCapturingRef.current ||
      isUploadingRef.current
    ) {
      console.warn(
        "[CesiumPreviewDialog] Error during cleanup/capture (ignored):",
        err.message
      );
      return;
    }

    // Only show errors if they're not related to scene access during cleanup
    const errorMessage = err.message || String(err);
    if (
      errorMessage.includes("Cannot read properties of undefined") &&
      errorMessage.includes("scene")
    ) {
      console.warn(
        "[CesiumPreviewDialog] Scene access error during cleanup (ignored):",
        errorMessage
      );
      return;
    }

    setError(err.message);
    setLoading(false);
  };

  const handleLocationNotSet = () => {
    setLocationNotSet(true);
  };

  // Reset state when dialog closes and clean up any existing canvases
  useEffect(() => {
    if (!open) {
      const wasCapturing = isCapturingRef.current;
      const wasUploading = isUploadingRef.current;

      if (isCapturingRef.current || isUploadingRef.current) {
        isCapturingRef.current = false;
        isUploadingRef.current = false;
        setCapturing(false);
        setUploading(false);
      }

      setLoading(true);
      setError(null);
      setLocationNotSet(false);
      setTilesetReady(false);
      setUploading(false);
      setCapturing(false);
      setShowTerrain(true);
      setSelectedImageryAssetId(null);
      originalTerrainProviderRef.current = null;
      currentImageryProviderRef.current = null;

      const delay = wasCapturing || wasUploading ? 1000 : 100;

      const cleanupTimeout = setTimeout(() => {
        if (
          viewerRef.current &&
          !isCapturingRef.current &&
          !isUploadingRef.current
        ) {
          destroyViewer(viewerRef);
        }
        tilesetRef.current = null;
        cleanupViewerDOM(containerRef);
      }, delay);

      return () => {
        clearTimeout(cleanupTimeout);
      };
    }

    // Cleanup function
    return () => {
      if (isCapturingRef.current || isUploadingRef.current) {
        return;
      }
      destroyViewer(viewerRef);
      setTimeout(() => {
        cleanupViewerDOM(containerRef);
      }, 100);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return {
    handleViewerReady,
    handleTilesetReady,
    handleError,
    handleLocationNotSet,
  };
}
