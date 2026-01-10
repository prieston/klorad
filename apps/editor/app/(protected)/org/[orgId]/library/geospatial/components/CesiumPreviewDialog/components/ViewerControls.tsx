"use client";

import React from "react";
import { Box, Switch, FormControlLabel } from "@mui/material";
import { ImageryBasemapSelector } from "@klorad/ui";
import type { Asset } from "@/app/utils/api";

interface ViewerControlsProps {
  viewerReady: boolean;
  loading: boolean;
  error: string | null;
  assetType?: string;
  imageryAssets: Asset[];
  loadingModels: boolean;
  selectedImageryAssetId: string | null;
  onImageryChange: (assetId: string | null) => void;
  showTerrain: boolean;
  onTerrainToggle: (checked: boolean) => void;
}

export function ViewerControls({
  viewerReady,
  loading,
  error,
  assetType,
  imageryAssets,
  loadingModels,
  selectedImageryAssetId,
  onImageryChange,
  showTerrain,
  onTerrainToggle,
}: ViewerControlsProps) {
  return (
    <>
      {/* Basemap Selector */}
      {viewerReady && !loading && !error && (
        <Box sx={{ mb: 2 }}>
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
            onChange={onImageryChange}
            disabled={
              loading ||
              !!error ||
              !viewerReady ||
              assetType === "IMAGERY"
            }
            label="Basemap"
            showNoneOption={true}
          />
        </Box>
      )}

      {/* Terrain Toggle Switch */}
      <Box
        sx={(theme) => ({
          backgroundColor:
            theme.palette.mode === "dark"
              ? "#14171A"
              : "rgba(255, 255, 255, 0.92)",
          borderRadius: "4px",
          border:
            theme.palette.mode === "dark"
              ? "1px solid rgba(255, 255, 255, 0.05)"
              : "1px solid rgba(226, 232, 240, 0.8)",
          mb: 2,
        })}
      >
        <FormControlLabel
          control={
            <Switch
              checked={showTerrain}
              onChange={(e) => onTerrainToggle(e.target.checked)}
              disabled={loading || !!error || !viewerReady}
              sx={(theme) => ({
                "& .MuiSwitch-switchBase.Mui-checked": {
                  color: theme.palette.primary.main,
                },
                "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                  backgroundColor: theme.palette.primary.main,
                },
              })}
            />
          }
          label="Show Terrain"
          sx={(theme) => ({
            margin: 0,
            padding: "8.5px 14px",
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
            "& .MuiFormControlLabel-label": {
              fontSize: "0.75rem",
              fontWeight: 400,
              color: theme.palette.text.secondary,
              flex: 1,
            },
          })}
          labelPlacement="start"
        />
      </Box>
    </>
  );
}
