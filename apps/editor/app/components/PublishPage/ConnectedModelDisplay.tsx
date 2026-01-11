"use client";

import React, { useMemo } from "react";
import { Box, Typography, CircularProgress, Alert, Divider } from "@mui/material";
import useSWR from "swr";
import { modelFetcher, type Asset } from "@/app/utils/api";
import { SupportiveDataDisplay } from "@/app/components/Builder/properties/SupportiveDataDisplay";

interface ConnectedModelDisplayProps {
  connectedModelId?: string;
  sceneObjects?: Array<{ id: string; assetId?: string; name?: string; [key: string]: unknown }>;
  projectId?: string;
}

export const ConnectedModelDisplay: React.FC<ConnectedModelDisplayProps> = ({
  connectedModelId,
  sceneObjects = [],
  projectId,
}) => {
  // Find the model in scene objects and extract assetId
  const connectedModel = useMemo(() => {
    if (!connectedModelId) return null;
    return sceneObjects.find((obj) => obj.id === connectedModelId) || null;
  }, [connectedModelId, sceneObjects]);

  const assetId = connectedModel?.assetId;

  // Build URL with projectId query parameter for public access
  const assetUrl = useMemo(() => {
    if (!assetId) return null;
    const url = `/api/models/${assetId}`;
    if (projectId) {
      return `${url}?projectId=${projectId}`;
    }
    return url;
  }, [assetId, projectId]);

  // Fetch asset data if we have an assetId
  const { data, error, isLoading } = useSWR<Asset>(
    assetUrl,
    modelFetcher
  );

  if (!connectedModelId || !connectedModel) {
    return null;
  }

  if (!assetId) {
    // Model exists but has no assetId - show model name only
    return (
      <Box sx={{ mt: 2 }}>
        <Divider sx={{ my: 2 }} />
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 600,
            color: (theme) => theme.palette.text.primary,
            mb: 1,
          }}
        >
          Connected Model
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: (theme) => theme.palette.text.secondary,
          }}
        >
          {connectedModel.name || connectedModelId}
        </Typography>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box sx={{ mt: 2 }}>
        <Divider sx={{ my: 2 }} />
        <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
          <CircularProgress size={20} />
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ mt: 2 }}>
        <Divider sx={{ my: 2 }} />
        <Alert severity="error" sx={{ fontSize: "0.75rem" }}>
          Failed to load model information
        </Alert>
      </Box>
    );
  }

  const asset = data;
  if (!asset) {
    return null;
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Divider sx={{ my: 2 }} />
      <Typography
        variant="subtitle2"
        sx={{
          fontWeight: 600,
          color: (theme) => theme.palette.text.primary,
          mb: 1,
        }}
      >
        Connected Model
      </Typography>
      <Typography
        variant="body2"
        sx={{
          color: (theme) => theme.palette.text.secondary,
          mb: 2,
        }}
      >
        {asset.name || asset.originalFilename || connectedModel.name || connectedModelId}
      </Typography>

      {/* Display supportive data */}
      <SupportiveDataDisplay assetId={assetId} projectId={projectId} />
    </Box>
  );
};
