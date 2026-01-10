import { useRef, useState } from "react";

/**
 * Hook to manage Cesium viewer state and refs
 */
export function useCesiumViewerState() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const tilesetRef = useRef<any>(null);
  const originalTerrainProviderRef = useRef<any>(null);
  const currentImageryProviderRef = useRef<any>(null);
  const isCapturingRef = useRef(false);
  const isUploadingRef = useRef(false);
  const dropdownInitializedRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationNotSet, setLocationNotSet] = useState(false);
  const [tilesetReady, setTilesetReady] = useState(false);
  const [showTerrain, setShowTerrain] = useState(true);
  const [selectedImageryAssetId, setSelectedImageryAssetId] = useState<
    string | null
  >(null);

  return {
    // Refs
    containerRef,
    viewerRef,
    tilesetRef,
    originalTerrainProviderRef,
    currentImageryProviderRef,
    isCapturingRef,
    isUploadingRef,
    dropdownInitializedRef,
    // State
    loading,
    setLoading,
    capturing,
    setCapturing,
    uploading,
    setUploading,
    error,
    setError,
    locationNotSet,
    setLocationNotSet,
    tilesetReady,
    setTilesetReady,
    showTerrain,
    setShowTerrain,
    selectedImageryAssetId,
    setSelectedImageryAssetId,
  };
}
