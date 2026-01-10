"use client";

import { useState, useRef } from "react";
import { useCesiumViewer } from "./hooks/useCesiumViewer";
import { useImagery } from "./hooks/useImagery";
import { useTerrain } from "./hooks/useTerrain";
import { TilesetRenderer } from "./components/TilesetRenderer";
import { ImageryRenderer } from "./components/ImageryRenderer";
import { TerrainRenderer } from "./components/TerrainRenderer";
import { LocationClickHandler } from "./components/LocationClickHandler";
import { CesiumLoadingScreen } from "../CesiumLoadingScreen";
import type { CesiumMinimalViewerProps } from "./types";

/**
 * Main Cesium Minimal Viewer Component
 *
 * A refactored, modular viewer with separated concerns:
 * - Custom hooks handle business logic
 * - Child components manage rendering
 * - Main component orchestrates everything
 */
export function CesiumMinimalViewer({
  containerRef,
  cesiumAssetId,
  cesiumApiKey,
  assetType,
  onViewerReady,
  onError,
  onLocationNotSet: _onLocationNotSet, // Intentionally unused
  onTilesetReady,
  initialTransform,
  metadata,
  enableLocationEditing = false,
  enableClickToPosition = false,
  enableAtmosphere = false,
  onLocationClick,
}: CesiumMinimalViewerProps) {
  const [tilesetForClickHandler, setTilesetForClickHandler] = useState<any>(null);
  const tilesetRef = useRef<any>(null);

  // Initialize Cesium viewer
  const { viewer, Cesium, isLoading, error } = useCesiumViewer({
    containerRef,
    cesiumApiKey,
    enableAtmosphere,
    onViewerReady,
    onError,
  });

  // Setup OpenStreetMap imagery for location editing
  useImagery({
    viewer,
    Cesium,
    enableOpenStreetMap: enableLocationEditing,
  });

  // Setup terrain for location editing
  useTerrain({
    viewer,
    Cesium,
    enabled: enableLocationEditing,
  });

  // Handle tileset ready callback with state update for click handler
  const handleTilesetReady = (tileset: any) => {
    tilesetRef.current = tileset;
    setTilesetForClickHandler(tileset);
    if (onTilesetReady) {
      onTilesetReady(tileset);
    }
  };

  // Render loading screen while initializing
  if (isLoading || error) {
    return <CesiumLoadingScreen />;
  }

  return (
    <>
      {/* Render terrain for TERRAIN type assets */}
      {cesiumAssetId && assetType === "TERRAIN" && (
        <TerrainRenderer
          viewer={viewer}
          Cesium={Cesium}
          cesiumAssetId={cesiumAssetId}
          cesiumApiKey={cesiumApiKey}
          enableLocationEditing={enableLocationEditing}
          initialTransform={initialTransform}
          onTilesetReady={handleTilesetReady}
          onError={onError}
        />
      )}

      {/* Render imagery for IMAGERY type assets */}
      {cesiumAssetId && assetType === "IMAGERY" && (
        <ImageryRenderer
          viewer={viewer}
          Cesium={Cesium}
          cesiumAssetId={cesiumAssetId}
          enableLocationEditing={enableLocationEditing}
          initialTransform={initialTransform}
          onError={onError}
        />
      )}

      {/* Render tileset for 3D Tiles and other types (excluding TERRAIN and IMAGERY) */}
      {cesiumAssetId && assetType !== "IMAGERY" && assetType !== "TERRAIN" && (
        <TilesetRenderer
          viewer={viewer}
          Cesium={Cesium}
          cesiumAssetId={cesiumAssetId}
          metadata={metadata}
          initialTransform={initialTransform}
          enableLocationEditing={enableLocationEditing}
          enableAtmosphere={enableAtmosphere}
          assetType={assetType}
          onTilesetReady={handleTilesetReady}
          onError={onError}
        />
      )}

      {/* Handle location click for editing */}
      {enableLocationEditing && enableClickToPosition && (
        <LocationClickHandler
          viewer={viewer}
          Cesium={Cesium}
          tileset={tilesetForClickHandler}
          enabled={enableClickToPosition}
          onLocationClick={onLocationClick}
        />
      )}
    </>
  );
}

