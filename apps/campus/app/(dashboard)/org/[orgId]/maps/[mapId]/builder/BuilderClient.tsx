"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddLocationAltIcon from "@mui/icons-material/AddLocationAlt";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import FlightTakeoffIcon from "@mui/icons-material/FlightTakeoff";
import SaveIcon from "@mui/icons-material/Save";
import ShareIcon from "@mui/icons-material/Share";
import CloseIcon from "@mui/icons-material/Close";
import PublicIcon from "@mui/icons-material/Public";
import { LocationSearch } from "@klorad/ui";
import { toast } from "react-toastify";
import { createSceneAPI } from "@klorad/api";
import type { CampusAPI, POI, POICategory } from "@klorad/api";
import { useSceneStore } from "@klorad/core";
import type { Map as MapboxMap, MapMouseEvent } from "mapbox-gl";

const MapboxViewer = dynamic(
  () => import("@klorad/engine-mapbox").then((m) => ({ default: m.MapboxViewer })),
  { ssr: false, loading: () => <MapLoadingFallback /> }
);

function MapLoadingFallback() {
  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "#0a0d10",
      }}
    >
      <CircularProgress size={32} />
    </Box>
  );
}

const POI_CATEGORY_COLORS: Record<POICategory, string> = {
  building: "#3b82f6",
  department: "#8b5cf6",
  library: "#f59e0b",
  dining: "#10b981",
  parking: "#6b7280",
  sports: "#ef4444",
  medical: "#ec4899",
  admin: "#0ea5e9",
  housing: "#f97316",
  amenity: "#84cc16",
  custom: "#94a3b8",
};

const CATEGORIES: POICategory[] = [
  "building", "department", "library", "dining",
  "parking", "sports", "medical", "admin", "housing", "amenity", "custom",
];

interface Props {
  mapId: string;
}

export default function BuilderClient({ mapId }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [pois, setPois] = useState<POI[]>([]);
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [placingPoi, setPlacingPoi] = useState(false);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const apiRef = useRef<CampusAPI | null>(null);

  useEffect(() => {
    const api = createSceneAPI("mapbox", "campus") as CampusAPI;
    apiRef.current = api;

    const unsub = api.events.on("object:select", ({ object }) => {
      setSelectedPoiId(object.id);
    });

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
      } catch {
        // new or unreachable map — fall back to empty defaults
      } finally {
        if (!cancelled) setSceneReady(true);
      }
    })();

    return () => {
      cancelled = true;
      unsub();
    };
  }, [mapId]);

  // Click-to-place: while placingPoi is true, the next map click creates a POI there
  useEffect(() => {
    if (!placingPoi) return;
    const map = useSceneStore.getState().mapboxMap as MapboxMap | null;
    if (!map) return;

    map.getCanvas().style.cursor = "crosshair";
    const onClick = (e: MapMouseEvent) => {
      if (!apiRef.current) return;
      const newPoi = apiRef.current.poi.add({
        name: "New Location",
        position: [e.lngLat.lng, e.lngLat.lat, 0],
        category: "building",
        description: "",
        view: {
          zoom: map.getZoom(),
          pitch: map.getPitch(),
          bearing: map.getBearing(),
        },
      });
      setPois(apiRef.current.poi.getAll());
      setSelectedPoiId(newPoi.id);
      setPlacingPoi(false);
    };
    map.once("click", onClick);

    return () => {
      map.off("click", onClick);
      map.getCanvas().style.cursor = "";
    };
  }, [placingPoi]);

  const selectedPoi = pois.find((p) => p.id === selectedPoiId) ?? null;

  const handleStartPlacingPoi = () => {
    const map = useSceneStore.getState().mapboxMap;
    if (!map) {
      toast.info("Map is still loading…");
      return;
    }
    setPlacingPoi(true);
    toast.info("Click on the map to place the POI", { autoClose: 2000 });
  };

  const handleFlyToPoi = (id: string) => {
    apiRef.current?.poi.flyTo(id);
  };

  const handleSelectPoi = (id: string) => {
    setSelectedPoiId(id);
    handleFlyToPoi(id);
  };

  const handleUseMapCenter = () => {
    if (!apiRef.current || !selectedPoiId) return;
    const map = useSceneStore.getState().mapboxMap as MapboxMap | null;
    if (!map) return;
    const c = map.getCenter();
    apiRef.current.poi.update(selectedPoiId, { position: [c.lng, c.lat, 0] });
    setPois(apiRef.current.poi.getAll());
  };

  const handleCaptureView = () => {
    if (!apiRef.current || !selectedPoiId) return;
    const map = useSceneStore.getState().mapboxMap as MapboxMap | null;
    if (!map) return;
    apiRef.current.poi.update(selectedPoiId, {
      view: {
        zoom: map.getZoom(),
        pitch: map.getPitch(),
        bearing: map.getBearing(),
      },
    });
    setPois(apiRef.current.poi.getAll());
    toast.success("Current view saved for this POI");
  };

  const handleClearView = () => {
    if (!apiRef.current || !selectedPoiId) return;
    apiRef.current.poi.update(selectedPoiId, { view: undefined });
    setPois(apiRef.current.poi.getAll());
  };

  const handleDeletePoi = (id: string) => {
    if (!apiRef.current) return;
    apiRef.current.poi.remove(id);
    setPois(apiRef.current.poi.getAll());
    if (selectedPoiId === id) setSelectedPoiId(null);
  };

  const handleUpdatePoi = (field: keyof POI, value: unknown) => {
    if (!apiRef.current || !selectedPoiId) return;
    apiRef.current.poi.update(selectedPoiId, { [field]: value });
    setPois(apiRef.current.poi.getAll());
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const sceneData = apiRef.current?.export();
      await fetch(`/api/maps/${mapId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneData }),
      });
      toast.success("Map saved");
    } catch {
      toast.error("Failed to save map");
    } finally {
      setSaving(false);
    }
  };

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/campus/${mapId}`
    : "";

  const handleCopyShareUrl = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success("Share link copied");
  };

  const handlePickLocation = (lat: number, lng: number) => {
    apiRef.current?.setLocation(lng, lat, { zoom: 17 });
    setLocationDialogOpen(false);
    toast.success("Map location updated — save to persist");
  };

  return (
    <Box sx={{ display: "flex", height: "calc(100vh - 64px)", overflow: "hidden" }}>
      {/* Map */}
      <Box sx={{ flex: 1, position: "relative" }}>
        {sceneReady ? <MapboxViewer /> : <MapLoadingFallback />}

        {placingPoi && (
          <Box
            sx={{
              position: "absolute",
              top: 12,
              left: "50%",
              transform: "translateX(-50%)",
              bgcolor: "rgba(234,179,8,0.95)",
              color: "#000",
              px: 2,
              py: 0.75,
              borderRadius: 1,
              fontSize: "0.8125rem",
              fontWeight: 600,
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              zIndex: 20,
            }}
          >
            Click on the map to place the POI
          </Box>
        )}

        {/* Top toolbar */}
        <Box
          sx={{
            position: "absolute",
            top: 12,
            right: sidebarOpen ? 260 : 12,
            display: "flex",
            gap: 1,
            transition: "right 0.2s",
          }}
        >
          <Button
            size="small"
            variant="outlined"
            startIcon={<PublicIcon />}
            onClick={() => setLocationDialogOpen(true)}
            sx={{ textTransform: "none" }}
          >
            Location
          </Button>
          <Button
            size="small"
            variant={placingPoi ? "outlined" : "contained"}
            color={placingPoi ? "warning" : "primary"}
            startIcon={placingPoi ? <CloseIcon /> : <AddLocationAltIcon />}
            onClick={() => (placingPoi ? setPlacingPoi(false) : handleStartPlacingPoi())}
            sx={{ textTransform: "none" }}
          >
            {placingPoi ? "Cancel" : "Add POI"}
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<ShareIcon />}
            onClick={handleCopyShareUrl}
            sx={{ textTransform: "none" }}
          >
            Share
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={saving ? <CircularProgress size={14} /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving}
            sx={{ textTransform: "none" }}
          >
            Save
          </Button>
        </Box>
      </Box>

      {/* Sidebar toggle */}
      <Box sx={{ position: "absolute", right: sidebarOpen ? 248 : 0, top: "50%", zIndex: 10 }}>
        <IconButton
          size="small"
          onClick={() => setSidebarOpen((v) => !v)}
          sx={{ bgcolor: "#14171a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px 0 0 4px" }}
        >
          {sidebarOpen ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
        </IconButton>
      </Box>

      {/* Sidebar */}
      <Drawer
        variant="persistent"
        anchor="right"
        open={sidebarOpen}
        sx={{
          width: 256,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: 256,
            position: "relative",
            height: "100%",
            bgcolor: "#0d1117",
            border: "none",
            borderLeft: "1px solid rgba(255,255,255,0.06)",
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>
            Points of Interest ({pois.length})
          </Typography>
          <List dense disablePadding>
            {pois.map((poi) => (
              <ListItemButton
                key={poi.id}
                selected={poi.id === selectedPoiId}
                onClick={() => handleSelectPoi(poi.id)}
                sx={{
                  borderRadius: 1,
                  mb: 0.25,
                  pr: 0.5,
                  "&.Mui-selected": { bgcolor: "rgba(59,130,246,0.1)" },
                }}
              >
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    bgcolor: POI_CATEGORY_COLORS[poi.category ?? "custom"],
                    mr: 1,
                    flexShrink: 0,
                  }}
                />
                <ListItemText
                  primary={poi.name}
                  secondary={poi.category}
                  primaryTypographyProps={{ fontSize: "0.8125rem", noWrap: true }}
                  secondaryTypographyProps={{ fontSize: "0.7rem" }}
                />
                <IconButton
                  size="small"
                  edge="end"
                  onClick={(e) => { e.stopPropagation(); handleFlyToPoi(poi.id); }}
                  sx={{ opacity: 0.5, "&:hover": { opacity: 1 }, mr: 0.25 }}
                  title="Fly to POI"
                >
                  <FlightTakeoffIcon sx={{ fontSize: 14 }} />
                </IconButton>
                <IconButton
                  size="small"
                  edge="end"
                  onClick={(e) => { e.stopPropagation(); handleDeletePoi(poi.id); }}
                  sx={{ opacity: 0.5, "&:hover": { opacity: 1 } }}
                  title="Delete POI"
                >
                  <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </ListItemButton>
            ))}
          </List>
        </Box>

        {selectedPoi && (
          <>
            <Divider sx={{ borderColor: "rgba(255,255,255,0.06)" }} />
            <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
              <Typography variant="subtitle2" fontWeight={700}>
                Edit POI
              </Typography>
              <TextField
                label="Name"
                size="small"
                fullWidth
                value={selectedPoi.name}
                onChange={(e) => handleUpdatePoi("name", e.target.value)}
              />
              <TextField
                label="Description"
                size="small"
                fullWidth
                multiline
                rows={2}
                value={selectedPoi.description ?? ""}
                onChange={(e) => handleUpdatePoi("description", e.target.value)}
              />
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.75, display: "block" }}>
                  Category
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {CATEGORIES.map((cat) => (
                    <Chip
                      key={cat}
                      label={cat}
                      size="small"
                      clickable
                      onClick={() => handleUpdatePoi("category", cat)}
                      sx={{
                        fontSize: "0.7rem",
                        height: 20,
                        bgcolor: selectedPoi.category === cat
                          ? POI_CATEGORY_COLORS[cat]
                          : "rgba(255,255,255,0.06)",
                        color: selectedPoi.category === cat ? "#fff" : "text.secondary",
                      }}
                    />
                  ))}
                </Box>
              </Box>

              <Divider sx={{ borderColor: "rgba(255,255,255,0.06)" }} />

              <Box>
                <Box sx={{ display: "flex", alignItems: "center", mb: 0.75, gap: 0.5 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                    Position
                  </Typography>
                  <Button
                    size="small"
                    startIcon={<FlightTakeoffIcon sx={{ fontSize: 14 }} />}
                    onClick={() => handleFlyToPoi(selectedPoi.id)}
                    sx={{ fontSize: "0.7rem", textTransform: "none", py: 0 }}
                  >
                    Fly to
                  </Button>
                  <Button
                    size="small"
                    startIcon={<MyLocationIcon sx={{ fontSize: 14 }} />}
                    onClick={handleUseMapCenter}
                    sx={{ fontSize: "0.7rem", textTransform: "none", py: 0 }}
                  >
                    Use center
                  </Button>
                </Box>
                <Stack direction="row" spacing={1}>
                  <TextField
                    label="Lng"
                    size="small"
                    type="number"
                    slotProps={{ htmlInput: { step: 0.000001 } }}
                    value={selectedPoi.position[0]}
                    onChange={(e) =>
                      handleUpdatePoi("position", [
                        parseFloat(e.target.value) || 0,
                        selectedPoi.position[1],
                        selectedPoi.position[2],
                      ])
                    }
                  />
                  <TextField
                    label="Lat"
                    size="small"
                    type="number"
                    slotProps={{ htmlInput: { step: 0.000001 } }}
                    value={selectedPoi.position[1]}
                    onChange={(e) =>
                      handleUpdatePoi("position", [
                        selectedPoi.position[0],
                        parseFloat(e.target.value) || 0,
                        selectedPoi.position[2],
                      ])
                    }
                  />
                </Stack>
                <TextField
                  label="Altitude (m)"
                  size="small"
                  fullWidth
                  type="number"
                  slotProps={{ htmlInput: { step: 1 } }}
                  value={selectedPoi.position[2]}
                  onChange={(e) =>
                    handleUpdatePoi("position", [
                      selectedPoi.position[0],
                      selectedPoi.position[1],
                      parseFloat(e.target.value) || 0,
                    ])
                  }
                  sx={{ mt: 1 }}
                />
              </Box>

              <Divider sx={{ borderColor: "rgba(255,255,255,0.06)" }} />

              <Box>
                <Box sx={{ display: "flex", alignItems: "center", mb: 0.75, gap: 0.5 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                    View (zoom / pitch / bearing)
                  </Typography>
                  <Button
                    size="small"
                    onClick={handleCaptureView}
                    sx={{ fontSize: "0.7rem", textTransform: "none", py: 0 }}
                  >
                    Capture
                  </Button>
                  {selectedPoi.view && (
                    <Button
                      size="small"
                      color="inherit"
                      onClick={handleClearView}
                      sx={{ fontSize: "0.7rem", textTransform: "none", py: 0, opacity: 0.6 }}
                    >
                      Clear
                    </Button>
                  )}
                </Box>
                {selectedPoi.view ? (
                  <Stack direction="row" spacing={1}>
                    <TextField
                      label="Zoom"
                      size="small"
                      type="number"
                      slotProps={{ htmlInput: { step: 0.1, min: 0, max: 22 } }}
                      value={selectedPoi.view.zoom ?? ""}
                      onChange={(e) =>
                        handleUpdatePoi("view", {
                          ...selectedPoi.view,
                          zoom: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                    <TextField
                      label="Pitch"
                      size="small"
                      type="number"
                      slotProps={{ htmlInput: { step: 1, min: 0, max: 85 } }}
                      value={selectedPoi.view.pitch ?? ""}
                      onChange={(e) =>
                        handleUpdatePoi("view", {
                          ...selectedPoi.view,
                          pitch: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                    <TextField
                      label="Bearing"
                      size="small"
                      type="number"
                      slotProps={{ htmlInput: { step: 1 } }}
                      value={selectedPoi.view.bearing ?? ""}
                      onChange={(e) =>
                        handleUpdatePoi("view", {
                          ...selectedPoi.view,
                          bearing: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </Stack>
                ) : (
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    No view saved. Fly-to uses defaults.
                  </Typography>
                )}
              </Box>
            </Box>
          </>
        )}
      </Drawer>

      <Dialog
        open={locationDialogOpen}
        onClose={() => setLocationDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1 }}>
          Search for a location
          <Typography variant="caption" display="block" color="text.secondary">
            Center this map on a new city, campus, or address.
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <LocationSearch onPlaceSelect={handlePickLocation} boxPadding={0} />
        </DialogContent>
      </Dialog>
    </Box>
  );
}
