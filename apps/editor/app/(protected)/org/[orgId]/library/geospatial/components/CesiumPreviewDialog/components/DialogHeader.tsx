"use client";

import React from "react";
import { Box, Typography, IconButton, Divider } from "@mui/material";
import { CloseIcon } from "@klorad/ui";

interface DialogHeaderProps {
  assetName: string;
  onClose: () => void;
  disabled?: boolean;
}

export function DialogHeader({
  assetName,
  onClose,
  disabled = false,
}: DialogHeaderProps) {
  return (
    <>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 3,
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Retake Photo - {assetName}
        </Typography>
        <IconButton
          size="small"
          onClick={onClose}
          disabled={disabled}
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
    </>
  );
}
