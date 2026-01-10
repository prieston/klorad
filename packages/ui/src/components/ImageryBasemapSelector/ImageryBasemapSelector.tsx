"use client";

import React, { useMemo } from "react";
import { Box, Select, MenuItem, Typography, CircularProgress } from "@mui/material";
import { selectStyles, menuItemStyles } from "../../styles/inputStyles";

export interface ImageryAsset {
  id: string;
  cesiumAssetId: string;
  cesiumApiKey: string;
  name?: string | null;
  originalFilename: string;
}

export interface ImageryBasemapSelectorProps {
  assets: ImageryAsset[];
  loading?: boolean;
  value?: string | null; // Selected asset ID
  onChange?: (assetId: string | null) => void;
  disabled?: boolean;
  label?: string;
  showNoneOption?: boolean; // Whether to show "None" option
}

/**
 * Reusable component for selecting imagery assets as basemap
 * Filters and displays IMAGERY type assets in a dropdown
 */
export const ImageryBasemapSelector: React.FC<ImageryBasemapSelectorProps> = ({
  assets,
  loading = false,
  value,
  onChange,
  disabled = false,
  label = "Basemap",
  showNoneOption = true,
}) => {
  // Filter for IMAGERY assets that have cesiumAssetId and cesiumApiKey
  const imageryAssets = useMemo(() => {
    return assets.filter(
      (asset) =>
        asset.cesiumAssetId &&
        asset.cesiumApiKey &&
        asset.id // Ensure asset has required fields
    );
  }, [assets]);

  const handleChange = (event: { target: { value: unknown } }) => {
    const selectedId = event.target.value as string;
    if (onChange) {
      onChange(selectedId === "" ? null : selectedId);
    }
  };

  return (
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
      })}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8.5px 14px",
        }}
      >
        <Typography
          sx={{
            fontSize: "0.75rem",
            fontWeight: 400,
            color: (theme) => theme.palette.text.secondary,
            flex: 1,
          }}
        >
          {label}
        </Typography>
        <Select
          value={value || ""}
          onChange={handleChange}
          disabled={disabled || loading || imageryAssets.length === 0}
          displayEmpty={showNoneOption}
          sx={selectStyles}
          MenuProps={{
            disablePortal: true,
            disableScrollLock: true,
            disableAutoFocus: true,
            disableEnforceFocus: true,
            disableRestoreFocus: true,
            BackdropProps: {
              invisible: true,
              sx: {
                pointerEvents: "auto",
                cursor: "default",
              },
            },
            PaperProps: {
              sx: (theme) => ({
                maxHeight: 300,
                zIndex: 1600,
                backgroundColor:
                  theme.palette.mode === "dark"
                    ? "#14171A"
                    : theme.palette.background.paper,
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "4px",
                mt: 0.5,
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
              }),
            },
            anchorOrigin: {
              vertical: "bottom",
              horizontal: "right",
            },
            transformOrigin: {
              vertical: "top",
              horizontal: "right",
            },
          }}
        >
          {loading ? (
            <MenuItem disabled sx={menuItemStyles}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  width: "100%",
                }}
              >
                <CircularProgress size={16} />
                <Typography sx={{ fontSize: "0.75rem" }}>Loading...</Typography>
              </Box>
            </MenuItem>
          ) : imageryAssets.length === 0 ? (
            <MenuItem disabled sx={menuItemStyles}>
              <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
                No imagery assets available
              </Typography>
            </MenuItem>
          ) : (
            (() => {
              const menuItems = [];
              if (showNoneOption) {
                menuItems.push(
                  <MenuItem key="none" value="" sx={menuItemStyles}>
                    <Typography sx={{ fontSize: "0.75rem" }}>None</Typography>
                  </MenuItem>
                );
              }
              imageryAssets.forEach((asset) => {
                menuItems.push(
                  <MenuItem key={asset.id} value={asset.id} sx={menuItemStyles}>
                    <Typography sx={{ fontSize: "0.75rem" }}>
                      {asset.name || asset.originalFilename}
                    </Typography>
                  </MenuItem>
                );
              });
              return menuItems;
            })()
          )}
        </Select>
      </Box>
    </Box>
  );
};
