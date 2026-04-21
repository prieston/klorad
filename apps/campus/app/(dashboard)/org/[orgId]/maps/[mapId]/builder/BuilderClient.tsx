"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  TextField,
  Typography,
} from "@mui/material";
import AddLocationAltIcon from "@mui/icons-material/AddLocationAlt";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SaveIcon from "@mui/icons-material/Save";
import ShareIcon from "@mui/icons-material/Share";
import { toast } from "react-toastify";
import { createSceneAPI } from "@klorad/api";
import type { CampusAPI, POI, POICategory } from "@klorad/api";

const MapboxViewer = dynamic<Record<string, never>>(
  () => import("@klorad/engine-mapbox").then((m) => m.default) as never,
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
  const apiRef = useRef<CampusAPI | null>(null);

  useEffect(() => {
    apiRef.current = createSceneAPI("mapbox", "campus") as CampusAPI;
    const pois = apiRef.current.poi.getAll();
    setPois(pois);

    const unsub = apiRef.current.events.on("object:select", ({ object }) => {
      setSelectedPoiId(object.id);
    });
    return () => unsub();
  }, []);

  const selectedPoi = pois.find((p) => p.id === selectedPoiId) ?? null;

  const handleAddPoi = () => {
    if (!apiRef.current) return;
    const newPoi = apiRef.current.poi.add({
      name: "New Location",
      position: [0, 0, 0],
      category: "building",
      description: "",
    });
    setPois(apiRef.current.poi.getAll());
    setSelectedPoiId(newPoi.id);
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

  return (
    <Box sx={{ display: "flex", height: "calc(100vh - 64px)", overflow: "hidden" }}>
      {/* Map */}
      <Box sx={{ flex: 1, position: "relative" }}>
        <MapboxViewer />

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
            variant="contained"
            startIcon={<AddLocationAltIcon />}
            onClick={handleAddPoi}
            sx={{ textTransform: "none" }}
          >
            Add POI
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
                onClick={() => setSelectedPoiId(poi.id)}
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
                  onClick={(e) => { e.stopPropagation(); handleDeletePoi(poi.id); }}
                  sx={{ opacity: 0.5, "&:hover": { opacity: 1 } }}
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
            </Box>
          </>
        )}
      </Drawer>
    </Box>
  );
}
