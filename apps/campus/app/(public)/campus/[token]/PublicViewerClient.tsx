"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import {
  Box,
  Chip,
  CircularProgress,
  Drawer,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import LayersIcon from "@mui/icons-material/Layers";
import TourIcon from "@mui/icons-material/Tour";
import { createSceneAPI } from "@klorad/api";
import type { CampusAPI, POI, TourStop } from "@klorad/api";

const MapboxViewer = dynamic(
  () => import("@klorad/engine-mapbox").then((m) => ({ default: m.MapboxViewer })),
  { ssr: false, loading: () => <MapLoadingFallback /> }
);

function MapLoadingFallback() {
  return (
    <Box sx={{ width: "100vw", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "#0a0d10" }}>
      <CircularProgress size={32} />
    </Box>
  );
}

interface Props {
  mapId: string;
}

type Panel = "search" | "tour" | "layers" | null;

export default function PublicViewerClient({ mapId }: Props) {
  const [activePanel, setActivePanel] = useState<Panel>(null);
  const [query, setQuery] = useState("");
  const [pois, setPois] = useState<POI[]>([]);
  const [tourStops, setTourStops] = useState<TourStop[]>([]);
  const [currentStop, setCurrentStop] = useState<number>(-1);
  const [sceneReady, setSceneReady] = useState(false);
  const apiRef = useRef<CampusAPI | null>(null);

  useEffect(() => {
    const api = createSceneAPI("mapbox", "campus") as CampusAPI;
    apiRef.current = api;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/maps/${mapId}`);
        if (!res.ok) throw new Error("Failed to load map");
        const data = await res.json();
        if (cancelled) return;
        if (data?.sceneData && typeof data.sceneData === "object" && Object.keys(data.sceneData).length > 0) {
          api.load(data.sceneData);
        }
        setPois(api.poi.getAll());
        setTourStops(api.tour.getAll());
      } catch {
        // unreachable map — show empty viewer rather than crash
      } finally {
        if (!cancelled) setSceneReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mapId]);

  const filteredPois = query.trim()
    ? pois.filter(
        (p) =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.description?.toLowerCase().includes(query.toLowerCase())
      )
    : pois;

  const flyToPoi = (poi: POI) => {
    apiRef.current?.poi.flyTo(poi.id);
    setActivePanel(null);
  };

  const togglePanel = (panel: Panel) =>
    setActivePanel((prev) => (prev === panel ? null : panel));

  const goToStop = (idx: number) => {
    apiRef.current?.tour.goTo(idx);
    setCurrentStop(idx);
  };

  return (
    <Box sx={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden" }}>
      {sceneReady ? <MapboxViewer /> : <MapLoadingFallback />}

      {/* Floating controls */}
      <Box
        sx={{
          position: "absolute",
          top: 16,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 1,
          bgcolor: "rgba(13,17,23,0.85)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 8,
          px: 1.5,
          py: 0.75,
        }}
      >
        <Tooltip title="Search">
          <IconButton size="small" onClick={() => togglePanel("search")} color={activePanel === "search" ? "primary" : "default"}>
            <SearchIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        {tourStops.length > 0 && (
          <Tooltip title="Tour">
            <IconButton size="small" onClick={() => togglePanel("tour")} color={activePanel === "tour" ? "primary" : "default"}>
              <TourIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title="Layers">
          <IconButton size="small" onClick={() => togglePanel("layers")} color={activePanel === "layers" ? "primary" : "default"}>
            <LayersIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Search panel */}
      <Drawer
        anchor="left"
        open={activePanel === "search"}
        onClose={() => setActivePanel(null)}
        variant="persistent"
        sx={{
          width: 300,
          "& .MuiDrawer-paper": {
            width: 300,
            top: 0,
            height: "100%",
            bgcolor: "rgba(13,17,23,0.95)",
            backdropFilter: "blur(12px)",
            border: "none",
            borderRight: "1px solid rgba(255,255,255,0.06)",
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1 }}>
              Search Campus
            </Typography>
            <IconButton size="small" onClick={() => setActivePanel(null)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
          <TextField
            fullWidth
            size="small"
            placeholder="Buildings, departments..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <List dense sx={{ mt: 1 }}>
            {filteredPois.map((poi) => (
              <ListItemButton
                key={poi.id}
                onClick={() => flyToPoi(poi)}
                sx={{ borderRadius: 1 }}
              >
                <ListItemText
                  primary={poi.name}
                  secondary={poi.category}
                  primaryTypographyProps={{ fontSize: "0.875rem" }}
                  secondaryTypographyProps={{ fontSize: "0.75rem" }}
                />
              </ListItemButton>
            ))}
            {filteredPois.length === 0 && query && (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
                No results for &ldquo;{query}&rdquo;
              </Typography>
            )}
          </List>
        </Box>
      </Drawer>

      {/* Tour panel */}
      {activePanel === "tour" && tourStops.length > 0 && (
        <Box
          sx={{
            position: "absolute",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            bgcolor: "rgba(13,17,23,0.9)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 2,
            p: 2,
            width: 380,
            maxWidth: "90vw",
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
            <Typography variant="subtitle2" fontWeight={700}>
              Campus Tour
            </Typography>
            <IconButton size="small" onClick={() => setActivePanel(null)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
          <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mb: 1 }}>
            {tourStops.map((stop, idx) => (
              <Chip
                key={stop.id}
                label={stop.title}
                size="small"
                clickable
                color={currentStop === idx ? "primary" : "default"}
                onClick={() => goToStop(idx)}
                sx={{ fontSize: "0.75rem" }}
              />
            ))}
          </Box>
          {currentStop >= 0 && tourStops[currentStop] && (
            <Typography variant="caption" color="text.secondary">
              {tourStops[currentStop].description}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}
