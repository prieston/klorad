"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  Dialog,
  Button,
  Box,
  Typography,
  IconButton,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { CloseIcon, LocationSearch, ImageryBasemapSelector } from "@klorad/ui";
import { OpenWith as OpenWithIcon, RotateRight as RotateRightIcon } from "@mui/icons-material";
import { useOrgId } from "@/app/hooks/useOrgId";
import useModels from "@/app/hooks/useModels";
import type { Asset } from "@/app/utils/api";
import {
  extractLocationFromTransform,
  extractHPRFromTransform,
  restoreTransform,
} from "./AdjustTilesetLocationDialog/utils/transform-utils";
import { cleanupCesiumViewer } from "./AdjustTilesetLocationDialog/utils/viewer-cleanup";
import { useTilesetLocationState } from "./AdjustTilesetLocationDialog/hooks/useTilesetLocationState";
import { useGeoreferencingDetection } from "./AdjustTilesetLocationDialog/hooks/useGeoreferencingDetection";
import { useManualInputs } from "./AdjustTilesetLocationDialog/hooks/useManualInputs";
import { useClickMode } from "./AdjustTilesetLocationDialog/hooks/useClickMode";
import { useDialogLifecycle } from "./AdjustTilesetLocationDialog/hooks/useDialogLifecycle";
import { useCursorStyle } from "./AdjustTilesetLocationDialog/hooks/useCursorStyle";
import { GeoreferencingInfoAlert } from "./AdjustTilesetLocationDialog/components/GeoreferencingInfoAlert";
import { ClickPositionButton } from "./AdjustTilesetLocationDialog/components/ClickPositionButton";
import { ManualAdjustmentsForm } from "./AdjustTilesetLocationDialog/components/ManualAdjustmentsForm";
import { CurrentLocationDisplay } from "./AdjustTilesetLocationDialog/components/CurrentLocationDisplay";
import { CesiumViewerContainer } from "./AdjustTilesetLocationDialog/components/CesiumViewerContainer";
import { PositionConfirmationDialog } from "./AdjustTilesetLocationDialog/components/PositionConfirmationDialog";
import { TilesetGizmo } from "./AdjustTilesetLocationDialog/components/TilesetGizmo";

interface AdjustTilesetLocationDialogProps {
  open: boolean;
  onClose: () => void;
  cesiumAssetId: string;
  cesiumApiKey: string;
  assetName: string;
  assetType?: string;
  initialTransform?: number[]; // Existing transform matrix (16 numbers)
  onSave: (
    transform: number[],
    longitude: number,
    latitude: number,
    height: number
  ) => Promise<void>;
}

const AdjustTilesetLocationDialog: React.FC<
  AdjustTilesetLocationDialogProps
> = ({
  open,
  onClose,
  cesiumAssetId,
  cesiumApiKey,
  assetName,
  assetType,
  initialTransform,
  onSave,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const cesiumRef = useRef<any>(null);
  const tilesetRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  const [gizmoMode, setGizmoMode] = useState<"translate" | "rotate">("translate");
  const [gizmoEnabled, setGizmoEnabled] = useState(false);
  const [selectedImageryAssetId, setSelectedImageryAssetId] = useState<string | null>(null);
  const currentImageryProviderRef = useRef<any>(null);
  const dropdownInitializedRef = useRef(false);
  const isApplyingManualChangesRef = useRef(false);
  const previousLocationRef = useRef<typeof locationState.currentLocation>(null);
  const previousTransformRef = useRef<typeof locationState.currentTransform>(undefined);

  // Location state management
  const locationState = useTilesetLocationState(initialTransform);

  // Georeferencing detection (needs to be created before manual inputs)
  const georeferencingDetection = useGeoreferencingDetection({
    initialTransform,
    onLocationDetected: (location) => {
      locationState.setCurrentLocation(location);
    },
    onHPRDetected: () => {
      // HPR will be set by manual inputs when location is detected
    },
  });

  // Manual inputs
  const manualInputs = useManualInputs({
    tilesetRef,
    cesiumRef,
    viewerRef,
    onTransformApplied: (transform, location) => {
      isApplyingManualChangesRef.current = true;
      locationState.setCurrentTransform(transform);
      locationState.setCurrentLocation(location);
      locationState.setLastConfirmedTransform(transform);
      georeferencingDetection.setIsGeoreferencedByDefault(false);
      // Reset flag after state updates
      setTimeout(() => {
        isApplyingManualChangesRef.current = false;
      }, 0);
    },
    onError: setError,
  });

  // Handle gizmo transform changes
  const handleGizmoTransformChange = useCallback(
    (transform: number[], location: { longitude: number; latitude: number; height: number }) => {
      isApplyingManualChangesRef.current = true;
      locationState.setCurrentTransform(transform);
      locationState.setCurrentLocation(location);
      locationState.setLastConfirmedTransform(transform);
      georeferencingDetection.setIsGeoreferencedByDefault(false);

      // Update manual inputs to reflect gizmo changes
      const updateManualInputs = async () => {
        try {
          const Cesium = await import("cesium");
          const hpr = extractHPRFromTransform(Cesium, transform);
          manualInputs.setValues(location, hpr);
        } catch (err) {
          console.error("Failed to update manual inputs from gizmo:", err);
        }
      };
      updateManualInputs();

      // Reset flag after state updates
      setTimeout(() => {
        isApplyingManualChangesRef.current = false;
      }, 0);
    },
    [locationState, georeferencingDetection, manualInputs]
  );

  // Initialize manual inputs when location is detected
  useEffect(() => {
    // Skip if we're currently applying manual changes to avoid overwriting user input
    if (isApplyingManualChangesRef.current) {
      return;
    }

    const isInitialLoad = previousLocationRef.current === null && locationState.currentLocation !== null;

    // Check if location or transform actually changed by comparing values
    const locationChanged =
      locationState.currentLocation !== previousLocationRef.current ||
      (locationState.currentLocation && previousLocationRef.current &&
        (locationState.currentLocation.longitude !== previousLocationRef.current.longitude ||
         locationState.currentLocation.latitude !== previousLocationRef.current.latitude ||
         locationState.currentLocation.height !== previousLocationRef.current.height)) ||
      locationState.currentTransform !== previousTransformRef.current ||
      (locationState.currentTransform && previousTransformRef.current &&
        JSON.stringify(locationState.currentTransform) !== JSON.stringify(previousTransformRef.current));

    if (!locationChanged && !isInitialLoad) {
      return;
    }

    if (
      isInitialLoad &&
      locationState.currentLocation &&
      initialTransform &&
      initialTransform.length === 16
    ) {
      const initializeManualInputs = async () => {
        try {
          const Cesium = await import("cesium");
          const hpr = extractHPRFromTransform(Cesium, initialTransform);
          manualInputs.setValues(locationState.currentLocation!, hpr);
        } catch (err) {
          console.error("Failed to initialize manual inputs:", err);
        }
      };
      initializeManualInputs();
    } else if (locationState.currentLocation && locationState.currentTransform) {
      // Extract HPR from current transform to preserve rotation values
      const updateManualInputs = async () => {
        try {
          const Cesium = await import("cesium");
          const hpr = extractHPRFromTransform(Cesium, locationState.currentTransform!);
          manualInputs.setValues(locationState.currentLocation!, hpr);
        } catch (err) {
          console.error("Failed to update manual inputs:", err);
          // Fallback: preserve current rotation values by reading them from state
          manualInputs.setValues(locationState.currentLocation!);
        }
      };
      updateManualInputs();
    } else if (locationState.currentLocation) {
      // Only reset rotation if there's no transform (initial state)
      manualInputs.setValues(locationState.currentLocation);
    }

    // Update refs after processing
    previousLocationRef.current = locationState.currentLocation;
    previousTransformRef.current = locationState.currentTransform;
  }, [locationState.currentLocation, locationState.currentTransform, initialTransform]);

  // Click mode
  const clickMode = useClickMode({
    tilesetRef,
    cesiumRef,
    viewerRef,
    lastConfirmedTransform: locationState.lastConfirmedTransform,
    onLocationClick: (location, transform) => {
      locationState.setPendingLocation(location);
      locationState.setCurrentTransform(transform);
      locationState.setCurrentLocation(location);
    },
    onTransformRestored: (transform, location) => {
      locationState.setCurrentTransform(transform);
      locationState.setCurrentLocation(location);
    },
  });

  // Dialog lifecycle - use useCallback to stabilize the onReset callback
  const handleDialogReset = useCallback(() => {
    locationState.reset(initialTransform);
    georeferencingDetection.reset();
    setLoading(true);
    setError(null);
  }, [initialTransform, locationState, georeferencingDetection]);

  const { stableInitialTransformRef } = useDialogLifecycle({
    open,
    initialTransform,
    onReset: handleDialogReset,
  });

  // Cleanup imagery provider when dialog closes
  useEffect(() => {
    return () => {
      if (viewerRef.current?.imageryLayers && currentImageryProviderRef.current) {
        try {
          viewerRef.current.imageryLayers.removeAll();
          currentImageryProviderRef.current = null;
        } catch (error) {
          // Ignore errors during cleanup
        }
      }
    };
  }, []);

  // Cursor style
  useCursorStyle(viewerRef, clickMode.clickModeEnabled, open);

  // Detect loaded imagery
  const detectLoadedImagery = useCallback(async (): Promise<string | null> => {
    if (!viewerRef.current || !imageryAssets.length) {
      return null;
    }

    try {
      const Cesium = await import("cesium");
      const imageryLayers = viewerRef.current.imageryLayers;

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
        "[AdjustTilesetLocationDialog] Error detecting loaded imagery:",
        err
      );
    }

    return null;
  }, [imageryAssets]);

  // Sync imagery selector with loaded imagery
  useEffect(() => {
    if (!open || !viewerRef.current || loading) {
      return;
    }

    // Only initialize dropdown once per dialog session
    if (dropdownInitializedRef.current) {
      return;
    }

    // Small delay to ensure viewer is fully initialized
    const timeoutId = setTimeout(() => {
      // Detect what imagery is currently loaded
      detectLoadedImagery().then((detectedId) => {
        if (detectedId) {
          setSelectedImageryAssetId(detectedId);
          // Store the current provider ref
          if (viewerRef.current?.imageryLayers?.length > 0) {
            const layer = viewerRef.current.imageryLayers.get(0);
            if (layer?.imageryProvider) {
              currentImageryProviderRef.current = layer.imageryProvider;
            }
          }
        } else {
          // No matching imagery asset detected - remove any default imagery
          if (viewerRef.current?.imageryLayers?.length > 0) {
            viewerRef.current.imageryLayers.removeAll();
          }
          setSelectedImageryAssetId(null);
        }
        dropdownInitializedRef.current = true;
      });
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [open, viewerRef, loading, detectLoadedImagery]);

  // Reset dropdown initialization flag when dialog closes
  useEffect(() => {
    if (!open) {
      dropdownInitializedRef.current = false;
    }
  }, [open]);

  // Viewer ready handler
  const handleViewerReady = useCallback(async (viewer: any) => {
    viewerRef.current = viewer;

    // Ensure no default imagery is loaded
    try {
      if (viewer.imageryLayers && viewer.imageryLayers.length > 0) {
        viewer.imageryLayers.removeAll();
      }
    } catch (err) {
      // Ignore errors
    }

    setLoading(false);
  }, []);

  // Tileset ready handler - combines georeferencing detection with manual inputs initialization
  const handleTilesetReady = useCallback(
    async (tileset: any) => {
      tilesetRef.current = tileset;

      try {
        const Cesium = await import("cesium");
        cesiumRef.current = Cesium;

        // Handle georeferencing detection (this will also initialize manual inputs if needed)
        await georeferencingDetection.handleTilesetReady(tileset);
      } catch (err) {
        console.error(
          "[AdjustTilesetLocationDialog] Failed to handle tileset ready:",
          err
        );
      }
    },
    [georeferencingDetection]
  );

  // Error handler
  const handleError = useCallback((err: Error) => {
    setError(err.message);
    setLoading(false);
  }, []);

  // Reset zoom handler
  const handleResetZoom = useCallback(async () => {
    if (!viewerRef.current || !tilesetRef.current) return;

    try {
      const Cesium = await import("cesium");
      viewerRef.current.zoomTo(
        tilesetRef.current,
        new Cesium.HeadingPitchRange(0, -0.5, 0)
      );
    } catch (err) {
      console.warn("[AdjustTilesetLocationDialog] Error resetting zoom:", err);
      try {
        if (viewerRef.current && tilesetRef.current) {
          viewerRef.current.zoomTo(tilesetRef.current);
        }
      } catch (fallbackErr) {
        console.error(
          "[AdjustTilesetLocationDialog] Error in fallback zoom:",
          fallbackErr
        );
      }
    }
  }, []);

  // Imagery change handler (similar to useImageryControl)
  const handleImageryChange = useCallback(
    async (assetId: string | null) => {
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
            "[AdjustTilesetLocationDialog] Selected asset not found or missing required fields"
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
        console.error("[AdjustTilesetLocationDialog] Error changing imagery:", err);
        setError(
          err instanceof Error ? err.message : "Failed to change basemap"
        );
      }
    },
    [imageryAssets]
  );

  // Location select handler (for LocationSearch)
  const handleLocationSelect = useCallback(
    async (assetId: string, latitude: number, longitude: number) => {
      if (!viewerRef.current) return;

      try {
        const Cesium = await import("cesium");
        viewerRef.current.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(
            longitude,
            latitude,
            10000
          ),
          duration: 2.0,
        });
      } catch (err) {
        console.error("Error flying to location:", err);
        setError(
          err instanceof Error ? err.message : "Failed to navigate to location"
        );
      }
    },
    []
  );

  // Confirm position handler
  const handleConfirmPosition = useCallback(() => {
    if (!locationState.currentTransform || !locationState.pendingLocation)
      return;

    georeferencingDetection.setIsGeoreferencedByDefault(false);
    locationState.setCurrentLocation(locationState.pendingLocation);
    locationState.setLastConfirmedTransform(locationState.currentTransform);
    manualInputs.setValues(locationState.pendingLocation);
    clickMode.confirmPosition();
    locationState.setPendingLocation(null);
  }, [locationState, georeferencingDetection, manualInputs, clickMode]);

  // Cancel position handler
  const handleCancelPosition = useCallback(async () => {
    if (
      locationState.lastConfirmedTransform &&
      tilesetRef.current &&
      cesiumRef.current &&
      viewerRef.current
    ) {
      const Cesium = cesiumRef.current;
      restoreTransform(
        tilesetRef.current,
        Cesium,
        locationState.lastConfirmedTransform,
        viewerRef.current
      );

      const location = extractLocationFromTransform(
        Cesium,
        locationState.lastConfirmedTransform
      );
      locationState.setCurrentTransform(locationState.lastConfirmedTransform);
      locationState.setCurrentLocation(location);
    }

    clickMode.cancelPosition();
    locationState.setPendingLocation(null);
  }, [locationState, tilesetRef, cesiumRef, viewerRef, clickMode]);

  // Save handler
  const handleSave = useCallback(async () => {
    if (!locationState.currentTransform || !locationState.currentLocation) {
      setError("Please click on the map to set a location first");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSave(
        locationState.currentTransform,
        locationState.currentLocation.longitude,
        locationState.currentLocation.latitude,
        locationState.currentLocation.height
      );
      onClose();
    } catch (err) {
      console.error("[AdjustTilesetLocationDialog] ❌ Failed to save:", err);
      setError(err instanceof Error ? err.message : "Failed to save location");
    } finally {
      setSaving(false);
    }
  }, [locationState, onSave, onClose]);

  // Cleanup on dialog close
  useEffect(() => {
    if (!open) {
      cleanupCesiumViewer(containerRef, viewerRef);
    }
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      slotProps={{
        backdrop: {
          sx: {
            zIndex: 1599,
          },
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
        {/* Header */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 3,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Adjust Tileset Location - {assetName}
          </Typography>
          <IconButton
            size="small"
            onClick={onClose}
            sx={{
              color: "text.secondary",
              "&:hover": {
                backgroundColor: "rgba(255, 255, 255, 0.05)",
              },
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* Content */}
        <Box
          sx={{
            display: "flex",
            gap: 3,
            height: "calc(80vh - 200px)",
            minHeight: "600px",
          }}
        >
          {/* Left Column - Controls */}
          <Box
            sx={{
              width: "380px",
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              gap: 2,
              overflowY: "auto",
              pr: 2,
            }}
          >
            {georeferencingDetection.isGeoreferencedByDefault ? (
              <GeoreferencingInfoAlert />
            ) : (
              <Typography
                sx={{
                  fontSize: "0.75rem",
                  color: "text.secondary",
                }}
              >
                Click on the map to position the tileset. You can search for a
                location below.
              </Typography>
            )}

            <ClickPositionButton
              clickModeEnabled={clickMode.clickModeEnabled}
              disabled={georeferencingDetection.isGeoreferencedByDefault}
              onToggle={clickMode.toggleClickMode}
            />

            {/* Gizmo Controls */}
            {!georeferencingDetection.isGeoreferencedByDefault && (
              <Box
                sx={{
                  p: 2,
                  backgroundColor: "rgba(255, 255, 255, 0.03)",
                  borderRadius: "4px",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                }}
              >
                <Typography
                  sx={{
                    fontSize: "0.813rem",
                    fontWeight: 600,
                    mb: 1.5,
                  }}
                >
                  Transform Gizmo
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                  <Button
                    variant={gizmoEnabled ? "contained" : "outlined"}
                    onClick={() => setGizmoEnabled(!gizmoEnabled)}
                    fullWidth
                    size="small"
                    sx={{
                      textTransform: "none",
                      fontSize: "0.75rem",
                      fontWeight: 500,
                    }}
                  >
                    {gizmoEnabled ? "Disable Gizmo" : "Enable Gizmo"}
                  </Button>
                  {gizmoEnabled && (
                    <ToggleButtonGroup
                      value={gizmoMode}
                      exclusive
                      onChange={(_, newMode) => {
                        if (newMode !== null) {
                          setGizmoMode(newMode);
                        }
                      }}
                      fullWidth
                      size="small"
                      sx={{
                        "& .MuiToggleButton-root": {
                          textTransform: "none",
                          fontSize: "0.75rem",
                          px: 1,
                        },
                      }}
                    >
                      <ToggleButton value="translate">
                        <OpenWithIcon sx={{ fontSize: "1rem", mr: 0.5 }} />
                        Move
                      </ToggleButton>
                      <ToggleButton value="rotate">
                        <RotateRightIcon sx={{ fontSize: "1rem", mr: 0.5 }} />
                        Rotate
                      </ToggleButton>
                    </ToggleButtonGroup>
                  )}
                </Box>
              </Box>
            )}

            {!georeferencingDetection.isGeoreferencedByDefault && (
              <Box>
                <LocationSearch
                  onAssetSelect={handleLocationSelect}
                  boxPadding={1}
                />
              </Box>
            )}

            {/* Basemap Selector */}
            {viewerRef.current && !loading && !error && (
              <Box sx={{ mb: 0 }}>
                <ImageryBasemapSelector
                  assets={imageryAssets.map((asset: Asset) => ({
                    id: asset.id,
                    cesiumAssetId: asset.cesiumAssetId || "",
                    cesiumApiKey: asset.cesiumApiKey || "",
                    name: asset.name,
                    originalFilename: asset.originalFilename,
                  }))}
                  loading={loadingModels}
                  value={selectedImageryAssetId}
                  onChange={handleImageryChange}
                  disabled={
                    loading ||
                    !!error ||
                    !viewerRef.current ||
                    assetType === "IMAGERY"
                  }
                  label="Basemap"
                  showNoneOption={true}
                />
              </Box>
            )}

            <ManualAdjustmentsForm
              longitude={manualInputs.manualLongitude}
              latitude={manualInputs.manualLatitude}
              height={manualInputs.manualHeight}
              heading={manualInputs.manualHeading}
              pitch={manualInputs.manualPitch}
              roll={manualInputs.manualRoll}
              onLongitudeChange={manualInputs.setManualLongitude}
              onLatitudeChange={manualInputs.setManualLatitude}
              onHeightChange={manualInputs.setManualHeight}
              onHeadingChange={manualInputs.setManualHeading}
              onPitchChange={manualInputs.setManualPitch}
              onRollChange={manualInputs.setManualRoll}
              onApply={manualInputs.applyManualChanges}
              disabled={georeferencingDetection.isGeoreferencedByDefault}
            />

            {locationState.currentLocation && (
              <CurrentLocationDisplay
                location={locationState.currentLocation}
              />
            )}
          </Box>

          {/* Right Column - Cesium Viewer */}
          <Box
            sx={{
              flex: 1,
              position: "relative",
              minWidth: 0,
            }}
          >
            <CesiumViewerContainer
              containerRef={containerRef}
              open={open}
              cesiumAssetId={cesiumAssetId}
              cesiumApiKey={cesiumApiKey}
              assetType={assetType}
              initialTransform={stableInitialTransformRef.current}
              loading={loading}
              error={error}
              viewerRef={viewerRef}
              tilesetRef={tilesetRef}
              onViewerReady={handleViewerReady}
              onError={handleError}
              onTilesetReady={handleTilesetReady}
              clickModeEnabled={clickMode.clickModeEnabled}
              onLocationClick={clickMode.handleLocationClick}
              onResetZoom={handleResetZoom}
            />

            {/* Gizmo Component */}
            {gizmoEnabled &&
              viewerRef.current &&
              tilesetRef.current &&
              cesiumRef.current &&
              locationState.currentLocation &&
              locationState.currentTransform &&
              !georeferencingDetection.isGeoreferencedByDefault &&
              !clickMode.clickModeEnabled && (
                <TilesetGizmo
                  viewer={viewerRef.current}
                  tileset={tilesetRef.current}
                  Cesium={cesiumRef.current}
                  currentTransform={locationState.currentTransform}
                  currentLocation={locationState.currentLocation}
                  onTransformChange={handleGizmoTransformChange}
                  transformMode={gizmoMode}
                  enabled={gizmoEnabled && !clickMode.clickModeEnabled}
                />
              )}

            {clickMode.showPositionConfirm && locationState.pendingLocation && (
              <PositionConfirmationDialog
                location={locationState.pendingLocation}
                onConfirm={handleConfirmPosition}
                onCancel={handleCancelPosition}
              />
            )}
          </Box>
        </Box>

        {/* Actions */}
        <Box
          sx={{ display: "flex", gap: 2, mt: 3, justifyContent: "flex-end" }}
        >
          <Button
            variant="outlined"
            onClick={onClose}
            disabled={saving}
            sx={(theme) => ({
              borderRadius: `${theme.shape.borderRadius}px`,
              textTransform: "none",
              fontSize: "0.75rem",
            })}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={
              saving ||
              loading ||
              !locationState.currentTransform ||
              georeferencingDetection.isGeoreferencedByDefault
            }
            sx={(theme) => ({
              borderRadius: `${theme.shape.borderRadius}px`,
              textTransform: "none",
              fontWeight: 500,
              fontSize: "0.75rem",
              backgroundColor:
                theme.palette.mode === "dark"
                  ? "#161B20"
                  : theme.palette.background.paper,
              color: theme.palette.primary.main,
              border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
              boxShadow: "none",
              "&:hover": {
                backgroundColor:
                  theme.palette.mode === "dark"
                    ? "#1a1f26"
                    : alpha(theme.palette.primary.main, 0.05),
                borderColor: alpha(theme.palette.primary.main, 0.5),
                boxShadow: "none",
              },
              "&:disabled": {
                opacity: 0.5,
              },
            })}
          >
            {saving ? "Saving..." : "Save Location"}
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
};

export default AdjustTilesetLocationDialog;
