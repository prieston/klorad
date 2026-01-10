import React from "react";
import { showTerrain, hideTerrain } from "../utils/terrain-utils";

interface UseTerrainControlProps {
  viewerRef: React.MutableRefObject<any>;
  originalTerrainProviderRef: React.MutableRefObject<any>;
  showTerrain: boolean;
  setShowTerrain: (show: boolean) => void;
}

/**
 * Hook to handle terrain toggle functionality
 */
export function useTerrainControl({
  viewerRef,
  originalTerrainProviderRef,
  showTerrain: _showTerrainState,
  setShowTerrain,
}: UseTerrainControlProps) {
  const handleTerrainToggle = async (checked: boolean) => {
    if (!viewerRef.current || !viewerRef.current.scene) {
      return;
    }

    try {
      if (checked) {
        await showTerrain(viewerRef.current, originalTerrainProviderRef);
      } else {
        await hideTerrain(viewerRef.current, originalTerrainProviderRef);
      }
      setShowTerrain(checked);
    } catch (err) {
      console.error("[CesiumPreviewDialog] Error toggling terrain:", err);
    }
  };

  return { handleTerrainToggle };
}
