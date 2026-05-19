"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Button, Chip, Stack, Typography, useTheme } from "@mui/material";
import { alpha } from "@mui/material/styles";
import CenterFocusStrongIcon from "@mui/icons-material/CenterFocusStrong";
import mapboxgl, { type Map as MapboxMap, type Marker } from "mapbox-gl";
import type { CampusMap } from "@/app/hooks/useMaps";

interface Props {
  maps: CampusMap[];
}

const FALLBACK_CENTER: [number, number] = [23.7275, 37.9838]; // Athens
const FALLBACK_ZOOM = 4;

export default function LocationsHeader({ maps }: Props) {
  const theme = useTheme();
  const pinColor = theme.palette.primary.main;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [ready, setReady] = useState(false);

  const pins = useMemo(
    () =>
      maps
        .filter(
          (m): m is CampusMap & { center: [number, number] } =>
            Array.isArray(m.center) &&
            typeof m.center[0] === "number" &&
            typeof m.center[1] === "number"
        )
        .map((m) => ({ id: m.id, name: m.name, center: m.center })),
    [maps]
  );

  const fitToExtent = () => {
    const map = mapRef.current;
    if (!map) return;
    if (pins.length === 0) {
      map.flyTo({ center: FALLBACK_CENTER, zoom: FALLBACK_ZOOM, duration: 800 });
      return;
    }
    if (pins.length === 1) {
      map.flyTo({ center: pins[0].center, zoom: 14, duration: 800 });
      return;
    }
    const bounds = new mapboxgl.LngLatBounds(pins[0].center, pins[0].center);
    for (const p of pins) bounds.extend(p.center);
    map.fitBounds(bounds, { padding: 48, duration: 800, maxZoom: 15 });
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!token) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: FALLBACK_CENTER,
      zoom: FALLBACK_ZOOM,
      attributionControl: false,
      interactive: true,
      cooperativeGestures: true,
    });
    map.on("load", () => setReady(true));
    mapRef.current = map;
    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    for (const pin of pins) {
      const el = document.createElement("div");
      el.style.width = "14px";
      el.style.height = "14px";
      el.style.borderRadius = "50%";
      el.style.background = pinColor;
      el.style.border = "2px solid #fff";
      el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.35)";
      el.title = pin.name;
      const marker = new mapboxgl.Marker(el).setLngLat(pin.center).addTo(mapRef.current);
      markersRef.current.push(marker);
    }

    fitToExtent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, ready, pinColor]);

  const hasToken = Boolean(process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN);

  return (
    <Box
      sx={(theme) => ({
        position: "relative",
        width: "100%",
        height: 200,
        borderRadius: 2,
        overflow: "hidden",
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
        mb: 3,
      })}
    >
      <Box ref={containerRef} sx={{ position: "absolute", inset: 0 }} />
      {!hasToken && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "text.secondary",
            fontSize: "0.875rem",
            px: 2,
            textAlign: "center",
          }}
        >
          Set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to see campus locations on a map.
        </Box>
      )}
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{
          position: "absolute",
          top: 12,
          left: 12,
          px: 1.5,
          py: 0.75,
          borderRadius: 999,
          backgroundColor: alpha(theme.palette.background.paper, 0.9),
          color: theme.palette.text.primary,
          border: `1px solid ${theme.palette.divider}`,
          backdropFilter: "blur(8px)",
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 600 }}>
          Campus locations
        </Typography>
        <Chip
          size="small"
          label={pins.length}
          sx={{
            height: 18,
            fontSize: "0.7rem",
            backgroundColor: alpha(theme.palette.primary.main, 0.16),
            color: theme.palette.primary.main,
            "& .MuiChip-label": { px: 1 },
          }}
        />
      </Stack>
      <Button
        size="small"
        variant="contained"
        onClick={fitToExtent}
        startIcon={<CenterFocusStrongIcon sx={{ fontSize: 16 }} />}
        disabled={pins.length === 0}
        sx={{
          position: "absolute",
          top: 12,
          right: 12,
          textTransform: "none",
          fontSize: "0.75rem",
          py: 0.5,
          px: 1.25,
        }}
      >
        Fit to extent
      </Button>
    </Box>
  );
}
