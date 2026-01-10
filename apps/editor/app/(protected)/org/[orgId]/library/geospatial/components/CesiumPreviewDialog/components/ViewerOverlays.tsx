"use client";

import React from "react";
import { Box, Typography, CircularProgress, IconButton } from "@mui/material";
import { FitScreen } from "@mui/icons-material";

interface ViewerOverlaysProps {
  loading: boolean;
  error: string | null;
  locationNotSet: boolean;
  tilesetReady: boolean;
  onResetZoom: () => void;
}

export function ViewerOverlays({
  loading,
  error,
  locationNotSet,
  tilesetReady,
  onResetZoom,
}: ViewerOverlaysProps) {
  return (
    <>
      {/* Reset Zoom Button */}
      {!loading && !error && tilesetReady && (
        <IconButton
          onClick={onResetZoom}
          sx={() => ({
            position: "absolute",
            top: 16,
            right: 16,
            zIndex: 20,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            color: "white",
            "&:hover": {
              backgroundColor: "rgba(0, 0, 0, 0.9)",
            },
            width: 40,
            height: 40,
          })}
          size="small"
          title="Reset Zoom"
        >
          <FitScreen sx={{ fontSize: "1.25rem" }} />
        </IconButton>
      )}

      {locationNotSet && (
        <Box
          sx={{
            position: "absolute",
            top: 16,
            left: 16,
            right: 16,
            zIndex: 20,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            borderRadius: "4px",
            padding: "8px 12px",
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          <Typography
            sx={{
              color: "warning.main",
              fontSize: "0.75rem",
              fontWeight: 500,
            }}
          >
            ℹ️ Tileset location has not been set
          </Typography>
        </Box>
      )}

      {loading && (
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            zIndex: 10,
          }}
        >
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            zIndex: 10,
            p: 2,
          }}
        >
          <Typography
            sx={{
              color: "error.main",
              textAlign: "center",
              fontSize: "0.875rem",
            }}
          >
            {error}
          </Typography>
        </Box>
      )}
    </>
  );
}
