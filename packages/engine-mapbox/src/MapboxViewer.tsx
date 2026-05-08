"use client";

import { Box, Typography } from "@mui/material";
import { useMapboxInitialization } from "./hooks/useMapboxInitialization";
import { MapboxViewerContent } from "./MapboxViewerContent";

export interface MapboxViewerProps {
  accessToken?: string;
}

export default function MapboxViewer({
  accessToken = typeof process !== "undefined"
    ? process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
    : undefined,
}: MapboxViewerProps) {
  const { map, error, containerRef } = useMapboxInitialization(accessToken);

  if (error) {
    return (
      <Box
        sx={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 2,
          bgcolor: "background.default",
        }}
      >
        <Typography color="error" variant="body2" textAlign="center">
          {error}
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "100%",
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          minWidth: "100%",
          minHeight: "100%",
        }}
      />
      {map ? <MapboxViewerContent map={map} /> : null}
    </>
  );
}
