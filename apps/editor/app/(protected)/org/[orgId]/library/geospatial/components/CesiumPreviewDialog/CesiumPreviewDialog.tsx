"use client";

/* eslint-disable no-console */
import React from "react";
import { Dialog, Box, Typography } from "@mui/material";
import { useOrgId } from "@/app/hooks/useOrgId";
import useModels from "@/app/hooks/useModels";
import type { Asset } from "@/app/utils/api";
import { useCesiumViewerState } from "./hooks/useCesiumViewerState";
import { useImagerySync } from "./hooks/useImagerySync";
import { useTerrainControl } from "./hooks/useTerrainControl";
import { useImageryControl } from "./hooks/useImageryControl";
import { useCaptureFlow } from "./hooks/useCaptureFlow";
import { useDialogLifecycle } from "./hooks/useDialogLifecycle";
import { useCameraControl } from "./hooks/useCameraControl";
import { DialogHeader } from "./components/DialogHeader";
import { ViewerControls } from "./components/ViewerControls";
import { CesiumViewerContainer } from "./components/CesiumViewerContainer";
import { ViewerOverlays } from "./components/ViewerOverlays";
import { DialogActions } from "./components/DialogActions";

interface CesiumPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  cesiumAssetId: string;
  cesiumApiKey: string;
  assetName: string;
  assetType?: string; // e.g., "IMAGERY", "3DTILES", etc.
  metadata?: Record<string, unknown> | null; // Model metadata (will extract transform from it)
  onCapture: (screenshot: string) => Promise<void>;
}

const CesiumPreviewDialog: React.FC<CesiumPreviewDialogProps> = ({
  open,
  onClose,
  cesiumAssetId,
  cesiumApiKey,
  assetName,
  assetType,
  metadata,
  onCapture,
}) => {
  // State management
  const state = useCesiumViewerState();

  // Fetch imagery assets
  const orgId = useOrgId();
  const { models, loadingModels } = useModels({
    assetType: "cesiumIonAsset",
    orgId: orgId || undefined,
  });

  // Filter for IMAGERY assets
  const imageryAssets = models.filter(
    (asset: Asset) =>
      asset.fileType === "IMAGERY" && asset.cesiumAssetId && asset.cesiumApiKey
  );

  // Imagery sync
  const { detectLoaded } = useImagerySync({
    open,
    assetType,
    cesiumAssetId,
    imageryAssets,
    viewerRef: state.viewerRef,
    dropdownInitializedRef: state.dropdownInitializedRef,
    selectedImageryAssetId: state.selectedImageryAssetId,
    setSelectedImageryAssetId: state.setSelectedImageryAssetId,
  });

  // Dialog lifecycle (needs to be initialized first for handleError)
  const { handleViewerReady, handleTilesetReady, handleError, handleLocationNotSet } =
    useDialogLifecycle({
      open,
      assetType,
      imageryAssets,
      viewerRef: state.viewerRef,
      tilesetRef: state.tilesetRef,
      containerRef: state.containerRef,
      originalTerrainProviderRef: state.originalTerrainProviderRef,
      currentImageryProviderRef: state.currentImageryProviderRef,
      isCapturingRef: state.isCapturingRef,
      isUploadingRef: state.isUploadingRef,
      setLoading: state.setLoading,
      setError: state.setError,
      setLocationNotSet: state.setLocationNotSet,
      setTilesetReady: state.setTilesetReady,
      setUploading: state.setUploading,
      setCapturing: state.setCapturing,
      setShowTerrain: state.setShowTerrain,
      setSelectedImageryAssetId: state.setSelectedImageryAssetId,
      selectedImageryAssetId: state.selectedImageryAssetId,
      detectLoaded,
    });

  // Terrain control
  const { handleTerrainToggle } = useTerrainControl({
    viewerRef: state.viewerRef,
    originalTerrainProviderRef: state.originalTerrainProviderRef,
    showTerrain: state.showTerrain,
    setShowTerrain: state.setShowTerrain,
  });

  // Imagery control
  const { handleImageryChange } = useImageryControl({
    viewerRef: state.viewerRef,
    imageryAssets,
    currentImageryProviderRef: state.currentImageryProviderRef,
    selectedImageryAssetId: state.selectedImageryAssetId,
    setSelectedImageryAssetId: state.setSelectedImageryAssetId,
    onError: handleError,
  });

  // Capture flow
  const { handleCapture, handleClose } = useCaptureFlow({
    viewerRef: state.viewerRef,
    isCapturingRef: state.isCapturingRef,
    isUploadingRef: state.isUploadingRef,
    capturing: state.capturing,
    uploading: state.uploading,
    setCapturing: state.setCapturing,
    setUploading: state.setUploading,
    setError: state.setError,
    onCapture,
    onClose,
  });

  // Camera control
  const { handleResetZoom } = useCameraControl({
    viewerRef: state.viewerRef,
    tilesetRef: state.tilesetRef,
    assetType,
  });

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      slotProps={{
        backdrop: {
          sx: {
            zIndex: 1599,
          },
          onClick:
            state.uploading || state.capturing
              ? (e) => e.stopPropagation()
              : undefined,
        },
      }}
      sx={{
        zIndex: 1600,
      }}
      PaperProps={{
        sx: (theme) => ({
          backgroundColor:
            theme.palette.mode === "dark"
              ? "#14171A !important"
              : theme.palette.background.paper,
          boxShadow: "none",
          position: "relative",
          zIndex: 1601,
          "&.MuiPaper-root": {
            backgroundColor:
              theme.palette.mode === "dark"
                ? "#14171A !important"
                : theme.palette.background.paper,
          },
        }),
      }}
    >
      <Box
        sx={(theme) => ({
          p: 3,
          backgroundColor:
            theme.palette.mode === "dark"
              ? "#14171A"
              : theme.palette.background.paper,
        })}
      >
        <DialogHeader
          assetName={assetName}
          onClose={handleClose}
          disabled={state.capturing || state.uploading}
        />

        {/* Content */}
        <Box>
          <Typography
            sx={{
              fontSize: "0.75rem",
              color: "text.secondary",
              textAlign: "center",
              mb: 2,
            }}
          >
            Rotate the model to your desired angle, then click &quot;Capture
            Screenshot&quot;
          </Typography>

          <ViewerControls
            viewerReady={!!state.viewerRef.current}
            loading={state.loading}
            error={state.error}
            assetType={assetType}
            imageryAssets={imageryAssets}
            loadingModels={loadingModels}
            selectedImageryAssetId={state.selectedImageryAssetId}
            onImageryChange={handleImageryChange}
            showTerrain={state.showTerrain}
            onTerrainToggle={handleTerrainToggle}
          />

          <CesiumViewerContainer
            containerRef={state.containerRef}
            open={open}
            cesiumAssetId={cesiumAssetId}
            cesiumApiKey={cesiumApiKey}
            assetType={assetType}
            metadata={metadata}
            onViewerReady={handleViewerReady}
            onTilesetReady={handleTilesetReady}
            onError={handleError}
            onLocationNotSet={handleLocationNotSet}
          >
            <ViewerOverlays
              loading={state.loading}
              error={state.error}
              locationNotSet={state.locationNotSet}
              tilesetReady={state.tilesetReady}
              onResetZoom={handleResetZoom}
            />
          </CesiumViewerContainer>
        </Box>

        <DialogActions
          capturing={state.capturing}
          uploading={state.uploading}
          loading={state.loading}
          error={state.error}
          viewerReady={!!state.viewerRef.current}
          tilesetReady={state.tilesetReady}
          onClose={handleClose}
          onCapture={handleCapture}
        />
      </Box>
    </Dialog>
  );
};

export default CesiumPreviewDialog;
