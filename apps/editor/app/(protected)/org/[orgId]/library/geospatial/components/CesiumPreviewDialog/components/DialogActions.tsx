"use client";

import React from "react";
import { Box, Button, CircularProgress } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { CameraAltIcon } from "@klorad/ui";

interface DialogActionsProps {
  capturing: boolean;
  uploading: boolean;
  loading: boolean;
  error: string | null;
  viewerReady: boolean;
  tilesetReady: boolean;
  onClose: () => void;
  onCapture: () => void;
}

export function DialogActions({
  capturing,
  uploading,
  loading,
  error,
  viewerReady,
  tilesetReady,
  onClose,
  onCapture,
}: DialogActionsProps) {
  return (
    <Box
      sx={{ display: "flex", gap: 2, mt: 3, justifyContent: "flex-end" }}
    >
      <Button
        variant="outlined"
        onClick={onClose}
        disabled={capturing || uploading}
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
        onClick={onCapture}
        disabled={
          capturing ||
          uploading ||
          loading ||
          !!error ||
          !viewerReady ||
          !tilesetReady
        }
        startIcon={
          uploading ? <CircularProgress size={16} /> : <CameraAltIcon />
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
        {capturing
          ? "Capturing..."
          : uploading
            ? "Uploading..."
            : "Capture Screenshot"}
      </Button>
    </Box>
  );
}
