"use client";

import React from "react";
import { Box } from "@mui/material";
import { CesiumMinimalViewer } from "@klorad/engine-cesium";

interface CesiumViewerContainerProps {
  containerRef: React.RefObject<HTMLDivElement>;
  open: boolean;
  cesiumAssetId: string;
  cesiumApiKey: string;
  assetType?: string;
  metadata?: Record<string, unknown> | null;
  onViewerReady: (viewer: any) => void;
  onTilesetReady: (tileset: any) => void;
  onError: (error: Error) => void;
  onLocationNotSet: () => void;
  children: React.ReactNode;
}

export function CesiumViewerContainer({
  containerRef,
  open,
  cesiumAssetId,
  cesiumApiKey,
  assetType,
  metadata,
  onViewerReady,
  onTilesetReady,
  onError,
  onLocationNotSet,
  children,
}: CesiumViewerContainerProps) {
  return (
    <Box
      ref={containerRef}
      sx={(theme) => ({
        width: "100%",
        height: "calc(80vh - 200px)",
        minHeight: "400px",
        borderRadius: "4px",
        overflow: "hidden",
        backgroundColor: theme.palette.background.default,
        border: "1px solid rgba(255, 255, 255, 0.08)",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        // Hide all Cesium credits and attribution
        "& .cesium-viewer-bottom": {
          display: "none !important",
        },
        "& .cesium-credit-text": {
          display: "none !important",
        },
        "& .cesium-credit-logoContainer": {
          display: "none !important",
        },
        "& .cesium-credit-expand-link": {
          display: "none !important",
        },
        "& .cesium-credit-logo": {
          display: "none !important",
        },
        "& .cesium-widget-credits": {
          display: "none !important",
        },
        // Ensure Cesium viewer fills container
        "& .cesium-viewer": {
          width: "100% !important",
          height: "100% !important",
          flex: "1 1 auto",
          minHeight: 0,
        },
        "& .cesium-viewer-cesiumWidgetContainer": {
          width: "100% !important",
          height: "100% !important",
        },
        "& .cesium-widget": {
          width: "100% !important",
          height: "100% !important",
        },
        "& .cesium-widget canvas": {
          width: "100% !important",
          height: "100% !important",
          display: "block",
        },
      })}
    >
      {open && (
        <CesiumMinimalViewer
          key={`cesium-preview-${cesiumAssetId}`}
          containerRef={containerRef}
          cesiumAssetId={cesiumAssetId}
          cesiumApiKey={cesiumApiKey}
          assetType={assetType}
          metadata={metadata}
          onViewerReady={onViewerReady}
          onTilesetReady={onTilesetReady}
          onError={onError}
          onLocationNotSet={onLocationNotSet}
          enableLocationEditing={false}
          enableAtmosphere={true}
        />
      )}
      {children}
    </Box>
  );
}
