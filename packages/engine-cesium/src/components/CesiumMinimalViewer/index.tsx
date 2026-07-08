"use client";

import { useState, useRef } from "react";
import { useCesiumViewer } from "./hooks/useCesiumViewer";
import { useImagery } from "./hooks/useImagery";
import { useTerrain } from "./hooks/useTerrain";
import { TilesetRenderer } from "./components/TilesetRenderer";
import { ImageryRenderer } from "./components/ImageryRenderer";
import { TerrainRenderer } from "./components/TerrainRenderer";
import { VectorDataSourceRenderer } from "./components/VectorDataSourceRenderer";
import { LocationClickHandler } from "./components/LocationClickHandler";
import { CesiumLoadingScreen } from "../CesiumLoadingScreen";
import {
  isVectorIonType,
  resolveIonType,
} from "../../utils/tileset-operations";
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

  // Resolve the actual Ion type from the DB `fileType` + `metadata`.
  // Direct-upload rows carry `fileType = "cesium-ion-tileset"` so we
  // need to consult `metadata.type` (populated by the upload polling
  // path) to distinguish 3D Tiles from KML/GeoJSON/CZML.
  const ionType = resolveIonType(assetType, metadata);
  const isVector = isVectorIonType(ionType);
  const isTerrainAsset = ionType === "TERRAIN" || assetType === "TERRAIN";
  const isImageryAsset = ionType === "IMAGERY" || assetType === "IMAGERY";

  return (
    <>
      {/* Render terrain for TERRAIN type assets */}
      {cesiumAssetId && isTerrainAsset && (
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
      {cesiumAssetId && isImageryAsset && (
        <ImageryRenderer
          viewer={viewer}
          Cesium={Cesium}
          cesiumAssetId={cesiumAssetId}
          enableLocationEditing={enableLocationEditing}
          initialTransform={initialTransform}
          onTilesetReady={handleTilesetReady}
          onError={onError}
        />
      )}

      {/* Render KML / GeoJSON / CZML as a Cesium DataSource — Ion
          returns raw XML/JSON for these, not tileset.json, so the
          3D-Tiles loader would `JSON.parse` an XML document and throw
          `Unexpected token '<', "<?xml vers"…`. */}
      {cesiumAssetId && isVector && (
        <VectorDataSourceRenderer
          viewer={viewer}
          Cesium={Cesium}
          cesiumAssetId={cesiumAssetId}
          ionType={ionType as "KML" | "GEOJSON" | "CZML"}
          onReady={handleTilesetReady}
          onError={onError}
        />
      )}

      {/* Render tileset for everything else (3D Tiles, glTF, or
          rows where the type isn't resolvable — historic default). */}
      {cesiumAssetId && !isTerrainAsset && !isImageryAsset && !isVector && (
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

