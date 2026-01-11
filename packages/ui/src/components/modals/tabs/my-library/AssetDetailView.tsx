import React, { useState } from "react";
import {
  Box,
  Typography,
  Button,
  IconButton,
  TextField,
  LinearProgress,
  Alert,
  Tooltip,
  Menu,
  MenuItem,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  Save,
  AddCircleOutline,
  CameraAlt,
  Refresh,
  LocationOn,
  MoreVert,
} from "@mui/icons-material";
import { MetadataTable, type MetadataRow } from "../../../table";
import type { LibraryAsset } from "../MyLibraryTab";
import { textFieldStyles } from "../../../../styles/inputStyles";

// Format file size from bytes to human-readable string
const formatFileSize = (bytes: number | null | undefined): string => {
  if (!bytes || bytes === 0) {
    return "";
  }

  // Convert bytes to GB
  const gb = bytes / (1024 * 1024 * 1024);

  // If less than 0.01 GB (about 10 MB), show in MB
  if (gb < 0.01) {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  }

  // Otherwise show in GB
  return `${gb.toFixed(2)} GB`;
};

interface AssetDetailViewProps {
  asset: LibraryAsset;
  isEditing: boolean;
  editedName: string;
  editedDescription: string;
  editedMetadata: MetadataRow[];
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onMetadataChange: (value: MetadataRow[]) => void;
  onEditClick: () => void;
  onCancelEdit: () => void;
  onSaveChanges: () => void;
  onDeleteClick: () => void;
  onAddToScene: () => void;
  onRetakePhoto: () => void;
  onRetryTiling?: () => void;
  onAdjustLocation?: () => void; // Callback for adjusting tileset location
  canUpdate?: boolean;
  showAddToScene?: boolean;
  renderAfterMetadata?: React.ReactNode; // Optional content to render after metadata table
}

export const AssetDetailView: React.FC<AssetDetailViewProps> = ({
  asset,
  isEditing,
  editedName,
  editedDescription,
  editedMetadata,
  onNameChange,
  onDescriptionChange,
  onMetadataChange,
  onEditClick,
  onCancelEdit,
  onSaveChanges,
  onDeleteClick,
  onAddToScene,
  onRetakePhoto,
  onRetryTiling,
  onAdjustLocation,
  canUpdate = true,
  showAddToScene = true,
  renderAfterMetadata,
}) => {
  // Menu state
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>) => {
    setMenuAnchor(e.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const handleEditClick = () => {
    handleMenuClose();
    onEditClick();
  };

  const handleRemoveClick = () => {
    handleMenuClose();
    onDeleteClick();
  };

  // Check tiling status for Cesium Ion assets
  const metadata = asset.metadata as Record<string, any> | undefined;
  const tilingStatus = metadata?.tilingStatus as string | undefined;
  const cesiumStatus = metadata?.status as string | undefined; // Status from Cesium Ion API (for synced assets)
  const tilingProgress = metadata?.tilingProgress as number | undefined;
  const isCesiumIonAsset =
    asset.assetType === "cesiumIonAsset" || !!asset.cesiumAssetId;

  // Check if tiling is complete:
  // 1. If tilingStatus is explicitly "COMPLETE" (for newly uploaded assets)
  // 2. If tilingStatus is undefined but cesiumStatus is "COMPLETE" or "ACTIVE" (for synced assets)
  //    Synced assets from Cesium Ion integrations don't have tilingStatus but have status from API
  const isTilingComplete =
    tilingStatus === "COMPLETE" ||
    (tilingStatus === undefined &&
      (cesiumStatus === "COMPLETE" || cesiumStatus === "ACTIVE"));

  const isTilingInProgress = tilingStatus === "IN_PROGRESS";
  const isTilingError = tilingStatus === "ERROR";

  // Check if model is georeferenced by default (from Cesium Ion, not manually set)
  // A model is georeferenced by default if:
  // 1. No transform exists in metadata (not manually set by user)
  // 2. AND the model likely has world coordinates (we can't check this here without loading the tileset)
  //
  // If metadata.transform exists, it means the user manually set it, so they should be able to adjust it.
  // We only disable the button if there's no transform AND we suspect it's georeferenced by default.
  // Since we can't check the modelMatrix here, we'll be conservative: only disable if we're certain
  // it's georeferenced by default. For now, we'll allow adjustment if transform exists (user set it).
  //
  // Note: The actual check for georeferenced-by-default happens in AdjustTilesetLocationDialog
  // where we can inspect the tileset's modelMatrix and bounding sphere.
  const isGeoreferencedByDefault = (() => {
    try {
      if (!metadata || typeof metadata !== "object") {
        // No metadata - can't determine, allow adjustment
        return false;
      }

      // Get transform - could be string (if Record<string, string>) or object (if Record<string, unknown>)
      const transform = (metadata as Record<string, unknown>).transform;

      // If transform exists in metadata, it means the user manually set it
      // So it's NOT georeferenced by default - allow adjustment
      if (transform) {
        return false;
      }

      // No transform in metadata - might be georeferenced by default
      // But we can't check modelMatrix here, so we'll be conservative and allow adjustment
      // The AdjustTilesetLocationDialog will do the actual check when opened
      return false;
    } catch (error) {
      return false;
    }
  })();

  return (
    <>
      <Box
        sx={(theme) => ({
          flex: 1,
          overflowY: "auto",
          padding: 2,
          paddingRight: 1,
          "&::-webkit-scrollbar": {
            width: "8px",
          },
          "&::-webkit-scrollbar-track": {
            background:
              theme.palette.mode === "dark"
                ? "rgba(107, 156, 216, 0.08)"
                : "rgba(95, 136, 199, 0.05)",
            borderRadius: "4px",
            margin: "4px 0",
          },
          "&::-webkit-scrollbar-thumb": {
            background:
              theme.palette.mode === "dark"
                ? "rgba(107, 156, 216, 0.24)"
                : "rgba(95, 136, 199, 0.2)",
            borderRadius: "4px",
            border: "2px solid transparent",
            backgroundClip: "padding-box",
            transition: "background 0.2s ease",
            "&:hover": {
              background:
                theme.palette.mode === "dark"
                  ? "rgba(107, 156, 216, 0.38)"
                  : "rgba(95, 136, 199, 0.35)",
              backgroundClip: "padding-box",
            },
          },
        })}
      >
        {/* Asset Info */}
        <Box sx={{ display: "flex", gap: 2, mb: 2, position: "relative" }}>
          {/* Three-Dot Menu Button - Top Right */}
          <IconButton
            onClick={handleMenuOpen}
            size="small"
            sx={(theme) => ({
              position: "absolute",
              top: 0,
              right: 0,
              color: theme.palette.text.secondary,
              padding: "4px",
              zIndex: 1,
              "&:hover": {
                backgroundColor: "rgba(255, 255, 255, 0.08)",
                color: theme.palette.text.primary,
              },
            })}
          >
            <MoreVert fontSize="small" />
          </IconButton>
          {/* Thumbnail */}
          <Box
            sx={(theme) => ({
              width: "120px",
              height: "120px",
              flexShrink: 0,
              borderRadius: "4px",
              overflow: "hidden",
              backgroundColor:
                theme.palette.mode === "dark"
                  ? "rgba(226, 232, 240, 0.05)"
                  : "rgba(226, 232, 240, 0.3)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              cursor: canUpdate ? "pointer" : "default",
              "&:hover .retake-overlay": {
                opacity: canUpdate ? 1 : 0,
              },
            })}
          >
            {asset.thumbnail || asset.thumbnailUrl ? (
              <img
                src={asset.thumbnail || asset.thumbnailUrl}
                alt={asset.name || asset.originalFilename}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            ) : (
              <Typography
                sx={{
                  fontSize: "0.625rem",
                  color: "rgba(100, 116, 139, 0.5)",
                  fontStyle: "italic",
                }}
              >
                No preview
              </Typography>
            )}

            {/* Hover Overlay */}
            {canUpdate && (
              <Box
                className="retake-overlay"
                onClick={onRetakePhoto}
                sx={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: "rgba(0, 0, 0, 0.6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "column",
                  gap: 0.5,
                  opacity: 0,
                  transition: "opacity 0.2s ease",
                }}
              >
                <CameraAlt sx={{ color: "white", fontSize: "2rem" }} />
                <Typography
                  sx={{
                    color: "white",
                    fontSize: "0.625rem",
                    fontWeight: 500,
                  }}
                >
                  Retake Photo
                </Typography>
              </Box>
            )}
          </Box>

          {/* Name and Description */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {isEditing ? (
              <>
                <Typography
                  sx={(theme) => ({
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: theme.palette.text.primary,
                    mb: 0.5,
                  })}
                >
                  Name
                </Typography>
                <TextField
                  id="asset-detail-name"
                  name="asset-detail-name"
                  value={editedName}
                  onChange={(e) => onNameChange(e.target.value)}
                  size="small"
                  fullWidth
                  sx={textFieldStyles}
                />
                <Typography
                  sx={(theme) => ({
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: theme.palette.text.primary,
                    mb: 0.5,
                    mt: 1.5,
                  })}
                >
                  Description
                </Typography>
                <TextField
                  id="asset-detail-description"
                  name="asset-detail-description"
                  value={editedDescription}
                  onChange={(e) => onDescriptionChange(e.target.value)}
                  size="small"
                  fullWidth
                  multiline
                  rows={2}
                  placeholder="Add a description..."
                  sx={textFieldStyles}
                />
              </>
            ) : (
              <>
                <Typography
                  variant="h6"
                  sx={{
                    fontSize: "1rem",
                    fontWeight: 600,
                    color: "text.primary",
                    mb: 0.5,
                  }}
                >
                  {asset.name || asset.originalFilename}
                </Typography>
                <Typography
                  sx={{
                    fontSize: "0.75rem",
                    color: "text.secondary",
                    mb: 0.5,
                    lineHeight: 1.4,
                    fontStyle: asset.description ? "normal" : "italic",
                  }}
                >
                  {asset.description || "No description"}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: "0.75rem",
                    color: "text.secondary",
                  }}
                >
                  {asset.fileType}
                  {asset.fileSize ? ` • ${formatFileSize(asset.fileSize)}` : ""}
                </Typography>
              </>
            )}
          </Box>
        </Box>

        {/* Metadata Table */}
        <Box>
          <Typography
            variant="subtitle2"
            sx={{
              fontSize: "1rem",
              fontWeight: 600,
              color: "text.primary",
              mb: 1,
            }}
          >
            Metadata
          </Typography>
          <MetadataTable
            data={editedMetadata}
            editable={isEditing}
            onChange={onMetadataChange}
          />
        </Box>

        {/* Optional content after metadata (e.g., supportive data) */}
        {renderAfterMetadata}
      </Box>

      {/* Three-Dot Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        sx={{
          "& .MuiPaper-root": {
            backgroundColor: "#14171A",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            boxShadow: "none",
            borderRadius: "4px",
            minWidth: "120px",
          },
        }}
      >
        <MenuItem
          onClick={handleEditClick}
          sx={{
            fontSize: "0.75rem",
            color: "text.primary",
            padding: "8px 16px",
            "&:hover": {
              backgroundColor: "rgba(107, 156, 216, 0.12)",
            },
          }}
        >
          Edit
        </MenuItem>
        <MenuItem
          onClick={handleRemoveClick}
          sx={{
            fontSize: "0.75rem",
            color: "text.primary",
            padding: "8px 16px",
            "&:hover": {
              backgroundColor: "rgba(239, 68, 68, 0.12)",
              color: "#ef4444",
            },
          }}
        >
          Remove
        </MenuItem>
      </Menu>

      {/* Tiling Status Banner */}
      {isCesiumIonAsset && isTilingInProgress && (
        <Box sx={{ px: 2, pb: 1 }}>
          <Alert severity="info" sx={{ fontSize: "0.75rem", py: 0.5 }}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <Typography variant="caption">
                Tiling in progress... This may take a few minutes.
              </Typography>
              <LinearProgress
                variant="determinate"
                value={tilingProgress || 0}
                sx={{ height: 6, borderRadius: 1 }}
              />
              <Typography variant="caption" sx={{ textAlign: "right" }}>
                {tilingProgress || 0}%
              </Typography>
            </Box>
          </Alert>
        </Box>
      )}

      {isCesiumIonAsset && isTilingError && (
        <Box sx={{ px: 2, pb: 1 }}>
          <Alert
            severity="error"
            sx={{ fontSize: "0.75rem" }}
            action={
              onRetryTiling ? (
                <Button
                  size="small"
                  startIcon={<Refresh />}
                  onClick={onRetryTiling}
                  sx={{
                    fontSize: "0.7rem",
                    textTransform: "none",
                    minWidth: "auto",
                    padding: "2px 8px",
                  }}
                >
                  Retry
                </Button>
              ) : undefined
            }
          >
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <Typography variant="caption">
                Tiling failed.{" "}
                {onRetryTiling
                  ? "Click Retry to check status again."
                  : "Please try uploading again."}
              </Typography>
            </Box>
          </Alert>
        </Box>
      )}

      {/* Fixed Action Bar */}
      <Box
        sx={{
          borderTop: "1px solid rgba(255, 255, 255, 0.08)",
          padding: 2,
          backgroundColor: "rgba(20, 23, 26, 0.88)",
          display: "flex",
          gap: 1,
          alignItems: "center",
        }}
      >
        {showAddToScene && (
          <Button
            variant="outlined"
            startIcon={<AddCircleOutline />}
            onClick={onAddToScene}
            disabled={Boolean(isCesiumIonAsset && !isTilingComplete)}
            sx={(theme) => ({
              borderRadius: "4px",
              textTransform: "none",
              fontWeight: 500,
              fontSize: "0.75rem",
              borderColor:
                theme.palette.mode === "dark"
                  ? "rgba(107, 156, 216, 0.35)"
                  : "rgba(95, 136, 199, 0.4)",
              color: theme.palette.primary.main,
              padding: "6px 16px",
              boxShadow: "none",
              "&:hover": {
                borderColor: theme.palette.primary.main,
                backgroundColor:
                  theme.palette.mode === "dark"
                    ? "rgba(107, 156, 216, 0.12)"
                    : "rgba(95, 136, 199, 0.08)",
                boxShadow: "none",
              },
              "&:disabled": {
                borderColor: "rgba(100, 116, 139, 0.2)",
                color: "rgba(100, 116, 139, 0.5)",
              },
            })}
          >
            {isCesiumIonAsset && !isTilingComplete
              ? "Tiling in progress..."
              : "Add to Scene"}
          </Button>
        )}

        {/* Adjust Tileset Location button - only for Cesium Ion 3D Tiles assets */}
        {isCesiumIonAsset &&
          (asset.fileType === "cesium-ion-tileset" ||
            asset.fileType === "3DTILES" ||
            asset.fileType?.includes("3DTILES")) &&
          onAdjustLocation && (
            <Tooltip
              title={
                isGeoreferencedByDefault
                  ? "This model is already georeferenced. Location adjustment is disabled."
                  : !isTilingComplete
                    ? "Tiling must be complete before adjusting location."
                    : ""
              }
            >
              <span>
                <Button
                  variant="outlined"
                  startIcon={<LocationOn />}
                  onClick={onAdjustLocation}
                  disabled={!isTilingComplete || isGeoreferencedByDefault}
                  sx={(theme) => ({
                    borderRadius: "4px",
                    textTransform: "none",
                    fontWeight: 500,
                    fontSize: "0.75rem",
                    borderColor:
                      theme.palette.mode === "dark"
                        ? "rgba(107, 156, 216, 0.35)"
                        : "rgba(95, 136, 199, 0.4)",
                    color: theme.palette.primary.main,
                    padding: "6px 16px",
                    boxShadow: "none",
                    "&:hover": {
                      borderColor: theme.palette.primary.main,
                      backgroundColor:
                        theme.palette.mode === "dark"
                          ? "rgba(107, 156, 216, 0.12)"
                          : "rgba(95, 136, 199, 0.08)",
                      boxShadow: "none",
                    },
                    "&:disabled": {
                      borderColor: "rgba(100, 116, 139, 0.2)",
                      color: "rgba(100, 116, 139, 0.5)",
                    },
                  })}
                >
                  Adjust Tileset Location
                </Button>
              </span>
            </Tooltip>
          )}

        <Box sx={{ flex: 1 }} />

        {isEditing && (
          <>
            <Button
              variant="contained"
              startIcon={<Save />}
              onClick={onSaveChanges}
              size="small"
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
                padding: "6px 16px",
                boxShadow: "none",
                "&:hover": {
                  backgroundColor:
                    theme.palette.mode === "dark"
                      ? "#1a1f26"
                      : alpha(theme.palette.primary.main, 0.05),
                  borderColor: alpha(theme.palette.primary.main, 0.5),
                },
              })}
            >
              Save
            </Button>
            <Button
              variant="outlined"
              onClick={onCancelEdit}
              size="small"
              sx={(theme) => ({
                borderRadius: `${theme.shape.borderRadius}px`,
                textTransform: "none",
                fontWeight: 500,
                fontSize: "0.75rem",
                padding: "6px 16px",
              })}
            >
              Cancel
            </Button>
          </>
        )}
      </Box>
    </>
  );
};
