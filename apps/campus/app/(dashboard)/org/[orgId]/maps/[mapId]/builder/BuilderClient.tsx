"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { v4 as uuidv4 } from "uuid";
import { alpha } from "@mui/material/styles";
import {
  LocationSearch,
  RightPanelContainer,
  TextField,
  FormField,
  ActionButton,
  SceneToolbar,
  AddLocationAltIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DeleteOutlineIcon,
  MyLocationIcon,
  FlightTakeoffIcon,
  SaveIcon,
  ShareIcon,
  CloseIcon,
  PublicIcon,
  NearMeIcon,
  OpenWithIcon,
  ApartmentIcon,
  LinkOffIcon,
} from "@klorad/ui";
import type { SceneTool } from "@klorad/ui";
import { toast } from "react-toastify";
import { createSceneAPI } from "@klorad/api";
import type { CampusAPI, POI, POICategory } from "@klorad/api";
import { useSceneStore } from "@klorad/core";
import type { Map as MapboxMap, MapMouseEvent } from "mapbox-gl";
import BuilderLeftPanel from "./BuilderLeftPanel";
import LevelSwitcher from "@/app/components/LevelSwitcher";
import { useMapboxPoiLayer } from "@/app/hooks/useMapboxPoiLayer";
import { useMapboxPoiDrag } from "@/app/hooks/useMapboxPoiDrag";
import { useMapboxFloorPlanLayer } from "@/app/hooks/useMapboxFloorPlanLayer";

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
        bgcolor: "background.default",
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
  const [activeTool, setActiveTool] = useState<"select" | "linkBuilding" | "edit">("select");
  const [activeView, setActiveView] = useState<"poi" | "location">("poi");
  const [sceneReady, setSceneReady] = useState(false);
  const apiRef = useRef<CampusAPI | null>(null);
  const mapboxScene = useSceneStore((s) => s.mapboxSceneData);
  const selectedMapboxBuilding = useSceneStore((s) => s.selectedMapboxBuilding);
  const setSelectedMapboxBuilding = useSceneStore((s) => s.setSelectedMapboxBuilding);

  useMapboxPoiLayer({
    pois,
    selectedPoiId,
    onPoiClick: (id) => setSelectedPoiId(id),
  });

  useMapboxPoiDrag({
    enabled: activeTool === "edit",
    onPoiMoved: (id, lng, lat) => {
      if (!apiRef.current) return;
      apiRef.current.poi.update(id, { position: [lng, lat, 0] });
      setPois(apiRef.current.poi.getAll());
    },
  });

  const [activeFloor, setActiveFloor] = useState<number | null>(null);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [eventForm, setEventForm] = useState({
    title: "",
    courseCode: "",
    lecturer: "",
    startsAt: "",
    endsAt: "",
  });

  const handleAddEvent = () => {
    if (!apiRef.current || !selectedPoiId) return;
    const poi = apiRef.current.poi.getAll().find((p) => p.id === selectedPoiId);
    if (!poi) return;
    const newEvent = {
      id: uuidv4(),
      title: eventForm.title,
      startsAt: new Date(eventForm.startsAt).toISOString(),
      endsAt: eventForm.endsAt
        ? new Date(eventForm.endsAt).toISOString()
        : new Date(new Date(eventForm.startsAt).getTime() + 60 * 60 * 1000).toISOString(),
      courseCode: eventForm.courseCode || undefined,
      lecturer: eventForm.lecturer || undefined,
    };
    apiRef.current.poi.update(selectedPoiId, {
      events: [...(poi.events ?? []), newEvent],
    });
    setPois(apiRef.current.poi.getAll());
    setEventDialogOpen(false);
    setEventForm({ title: "", courseCode: "", lecturer: "", startsAt: "", endsAt: "" });
  };

  const handleRemoveEvent = (poiId: string, eventId: string) => {
    if (!apiRef.current) return;
    const poi = apiRef.current.poi.getAll().find((p) => p.id === poiId);
    if (!poi) return;
    apiRef.current.poi.update(poiId, {
      events: (poi.events ?? []).filter((e) => e.id !== eventId),
    });
    setPois(apiRef.current.poi.getAll());
  };

  // Floor plans available for the currently-selected POI's building
  const floorPlansForSelection = useMemo(() => {
    if (!apiRef.current || !selectedPoiId) return [];
    return apiRef.current.floorPlans.forBuilding(selectedPoiId);
  }, [selectedPoiId, pois]);

  const activePlan = useMemo(() => {
    if (activeFloor === null) return null;
    return floorPlansForSelection.find((p) => p.floor === activeFloor) ?? null;
  }, [activeFloor, floorPlansForSelection]);

  useMapboxFloorPlanLayer(activePlan);

  // Reset active floor when selection changes
  useEffect(() => {
    setActiveFloor(null);
  }, [selectedPoiId]);

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

  // Link-to-building: while the tool is active, clicks on Mapbox buildings
  // surface via selectedMapboxBuilding. Attach the building to the selected POI.
  useEffect(() => {
    if (activeTool !== "linkBuilding") return;
    const map = useSceneStore.getState().mapboxMap as MapboxMap | null;
    if (map) map.getCanvas().style.cursor = "crosshair";
    return () => {
      if (map) map.getCanvas().style.cursor = "";
    };
  }, [activeTool]);

  useEffect(() => {
    if (activeTool !== "linkBuilding") return;
    if (!selectedMapboxBuilding || !selectedPoiId || !apiRef.current) return;
    const { properties, lng, lat } = selectedMapboxBuilding;
    if (typeof lng !== "number" || typeof lat !== "number") return;

    const label = (properties?.name as string) || (properties?.class as string) || "Building";

    apiRef.current.poi.update(selectedPoiId, {
      linkedBuilding: {
        lng,
        lat,
        properties,
        label,
      },
    });
    setPois(apiRef.current.poi.getAll());
    setSelectedMapboxBuilding(null);
    setActiveTool("select");
    toast.success(`Linked POI to ${label}`);
  }, [selectedMapboxBuilding, activeTool, selectedPoiId, setSelectedMapboxBuilding]);

  // Highlight the linked building on the map when a POI is selected.
  // Uses a temporary marker layer; removed on deselect.
  useEffect(() => {
    const poi = pois.find((p) => p.id === selectedPoiId);
    const linked = poi?.linkedBuilding;
    const map = useSceneStore.getState().mapboxMap as MapboxMap | null;
    if (!map) return;

    const sourceId = "campus-linked-building-highlight";
    const layerId = "campus-linked-building-highlight-layer";
    const pulseLayerId = "campus-linked-building-highlight-pulse";

    const removeHighlight = () => {
      try {
        if (map.getLayer(pulseLayerId)) map.removeLayer(pulseLayerId);
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch {
        /* map may be tearing down */
      }
    };

    if (!linked) {
      removeHighlight();
      return;
    }

    const addHighlight = () => {
      try {
        if (map.getSource(sourceId)) removeHighlight();
        map.addSource(sourceId, {
          type: "geojson",
          data: {
            type: "Feature",
            geometry: { type: "Point", coordinates: [linked.lng, linked.lat] },
            properties: {},
          },
        });
        map.addLayer({
          id: pulseLayerId,
          type: "circle",
          source: sourceId,
          paint: {
            "circle-radius": 22,
            "circle-color": "#6b9cd8",
            "circle-opacity": 0.18,
            "circle-blur": 0.4,
          },
        });
        map.addLayer({
          id: layerId,
          type: "circle",
          source: sourceId,
          paint: {
            "circle-radius": 10,
            "circle-color": "#6b9cd8",
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
            "circle-opacity": 0.95,
          },
        });
      } catch {
        /* ignore */
      }
    };

    if (map.isStyleLoaded()) addHighlight();
    else map.once("load", addHighlight);

    return () => removeHighlight();
  }, [selectedPoiId, pois]);

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

  const handleFlyToSavedLocation = () => {
    const map = useSceneStore.getState().mapboxMap as MapboxMap | null;
    if (!map) return;
    const { center, zoom, pitch, bearing } = useSceneStore.getState().mapboxSceneData;
    map.flyTo({
      center: [center[0], center[1]],
      zoom,
      pitch,
      bearing,
      duration: 1500,
      essential: true,
    });
  };

  const handleSetCameraAsLocation = () => {
    const map = useSceneStore.getState().mapboxMap as MapboxMap | null;
    if (!map || !apiRef.current) return;
    const c = map.getCenter();
    apiRef.current.setLocation(c.lng, c.lat, {
      zoom: map.getZoom(),
      pitch: map.getPitch(),
      bearing: map.getBearing(),
      fly: false,
    });
    toast.success("Camera position saved as project location");
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

  const sceneTools: SceneTool[] = [
    {
      id: "select",
      icon: <NearMeIcon fontSize="small" />,
      label: "Select",
      active: activeTool === "select",
      onClick: () => setActiveTool("select"),
    },
    {
      id: "edit",
      icon: <OpenWithIcon fontSize="small" />,
      label: "Move POIs — drag any pin to reposition",
      active: activeTool === "edit",
      onClick: () =>
        setActiveTool((prev) => (prev === "edit" ? "select" : "edit")),
    },
    {
      id: "linkBuilding",
      icon: <ApartmentIcon fontSize="small" />,
      label: selectedPoiId
        ? "Link building to selected POI"
        : "Link building (select a POI first)",
      active: activeTool === "linkBuilding",
      onClick: () => {
        if (!selectedPoiId) {
          toast.info("Select a POI first, then click a building.");
          return;
        }
        setActiveTool((prev) => (prev === "linkBuilding" ? "select" : "linkBuilding"));
      },
    },
  ];

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/campus/${mapId}`
    : "";

  const handleCopyShareUrl = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success("Share link copied");
  };

  const handlePickLocation = (lat: number, lng: number) => {
    apiRef.current?.setLocation(lng, lat, { zoom: 17 });
    toast.success("Map location updated — save to persist");
  };

  return (
    <Box sx={{ display: "flex", height: "calc(100vh - 64px)", overflow: "hidden" }}>
      <BuilderLeftPanel pois={pois} />

      {/* Map */}
      <Box sx={{ flex: 1, position: "relative" }}>
        {sceneReady ? <MapboxViewer /> : <MapLoadingFallback />}

        {/* Scene tools — centered floating bar above the map,
            positioned between the left sidebar (376px) and the right
            panel (416px when open, 0 when closed). */}
        <Box
          sx={{
            position: "fixed",
            top: 16,
            left: sidebarOpen ? "calc(50% - 20px)" : "calc(50% + 188px)",
            transform: "translateX(-50%)",
            zIndex: 1401,
            transition: "left 0.2s",
          }}
        >
          <SceneToolbar tools={sceneTools} orientation="horizontal" />
        </Box>

        {floorPlansForSelection.length > 0 && (
          <LevelSwitcher
            plans={floorPlansForSelection}
            activeFloor={activeFloor}
            onSelectFloor={setActiveFloor}
          />
        )}

        {placingPoi && (
          <Box
            sx={{
              position: "absolute",
              top: 76,
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

        {activeTool === "linkBuilding" && (
          <Box
            sx={{
              position: "absolute",
              top: 76,
              left: "50%",
              transform: "translateX(-50%)",
              bgcolor: (t) => alpha(t.palette.primary.main, 0.95),
              color: "#fff",
              px: 2,
              py: 0.75,
              borderRadius: 1,
              fontSize: "0.8125rem",
              fontWeight: 600,
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              zIndex: 20,
            }}
          >
            {selectedPoiId
              ? "Click a building to link it to the selected POI"
              : "Select a POI first, then click a building"}
          </Box>
        )}

        {activeTool === "edit" && (
          <Box
            sx={{
              position: "absolute",
              top: 76,
              left: "50%",
              transform: "translateX(-50%)",
              bgcolor: (t) => alpha(t.palette.primary.main, 0.95),
              color: "#fff",
              px: 2,
              py: 0.75,
              borderRadius: 1,
              fontSize: "0.8125rem",
              fontWeight: 600,
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              zIndex: 20,
            }}
          >
            Drag any POI pin to reposition it
          </Box>
        )}

      </Box>

      {/* Sidebar toggle (collapsed only) */}
      {!sidebarOpen && (
        <IconButton
          onClick={() => setSidebarOpen(true)}
          sx={{
            position: "fixed",
            right: 16,
            top: 16,
            zIndex: 1401,
            bgcolor: "var(--glass-bg)",
            border: "1px solid var(--glass-border)",
            backdropFilter: "blur(24px)",
            "&:hover": { bgcolor: "var(--glass-bg)" },
          }}
        >
          <ChevronLeftIcon fontSize="small" />
        </IconButton>
      )}

      {/* Sidebar — glass right panel, matches editor's builder */}
      {sidebarOpen && (
        <RightPanelContainer
          previewMode={false}
          className="glass-panel"
          sx={{
            position: "fixed",
            right: 16,
            top: 16,
            height: "calc(100vh - 32px)",
            maxHeight: "calc(100vh - 32px) !important",
            width: 400,
            marginLeft: 0,
            padding: 0,
            zIndex: 1400,
          }}
        >
          {/* Action bar — mirrors editor's builder RightPanel header */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 0.5,
              height: 64,
              px: 1,
              borderBottom: "1px solid rgba(100,116,139,0.2)",
              flexShrink: 0,
            }}
          >
            <ActionButton
              icon={<PublicIcon />}
              label="Location"
              active={activeView === "location"}
              onClick={() => {
                setActiveView("location");
                if (placingPoi) setPlacingPoi(false);
              }}
            />
            <ActionButton
              icon={<AddLocationAltIcon />}
              label="POI"
              active={activeView === "poi"}
              onClick={() => setActiveView("poi")}
            />
            <ActionButton
              icon={<ShareIcon />}
              label="Share"
              onClick={handleCopyShareUrl}
            />
            <ActionButton
              icon={saving ? <CircularProgress size={18} /> : <SaveIcon />}
              label="Save"
              onClick={handleSave}
              disabled={saving}
            />
            <IconButton size="small" onClick={() => setSidebarOpen(false)} sx={{ ml: 0.5 }}>
              <ChevronRightIcon fontSize="small" />
            </IconButton>
          </Box>

          {activeView === "location" && (
            <Box sx={{ flex: 1, overflow: "auto", p: 2, display: "flex", flexDirection: "column", gap: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography
                  variant="overline"
                  sx={{
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    color: "text.secondary",
                    letterSpacing: "0.08em",
                    flex: 1,
                  }}
                >
                  Saved Location
                </Typography>
                <Button
                  size="small"
                  startIcon={<FlightTakeoffIcon sx={{ fontSize: 14 }} />}
                  onClick={handleFlyToSavedLocation}
                  sx={{ textTransform: "none", fontSize: "0.7rem", py: 0.25 }}
                >
                  Fly to
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<MyLocationIcon sx={{ fontSize: 14 }} />}
                  onClick={handleSetCameraAsLocation}
                  sx={{ textTransform: "none", fontSize: "0.7rem", py: 0.25 }}
                >
                  Set camera
                </Button>
              </Box>

              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 1,
                  bgcolor: (t) => alpha(t.palette.primary.main, 0.06),
                  border: "1px solid",
                  borderColor: "divider",
                }}
              >
                <Stack direction="row" spacing={2}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: "0.65rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      Longitude
                    </Typography>
                    <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: "0.8125rem", fontWeight: 600 }}>
                      {mapboxScene.center[0].toFixed(6)}
                    </Typography>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: "0.65rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      Latitude
                    </Typography>
                    <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: "0.8125rem", fontWeight: 600 }}>
                      {mapboxScene.center[1].toFixed(6)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: "0.65rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      Zoom
                    </Typography>
                    <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: "0.8125rem", fontWeight: 600 }}>
                      {mapboxScene.zoom.toFixed(1)}
                    </Typography>
                  </Box>
                </Stack>
              </Box>

              <Divider />

              <Typography
                variant="overline"
                sx={{
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  color: "text.secondary",
                  letterSpacing: "0.08em",
                }}
              >
                Change Location
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.8125rem" }}>
                Search for a city, campus, or address to re-center this map. Save to persist.
              </Typography>
              <LocationSearch onPlaceSelect={handlePickLocation} boxPadding={0} />
            </Box>
          )}

          {activeView === "poi" && (
            <>
              {/* POI section label + inline Add */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  px: 2,
                  pt: 2,
                  pb: 1,
                  flexShrink: 0,
                }}
              >
                <Typography
                  variant="overline"
                  sx={{
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    color: "text.secondary",
                    letterSpacing: "0.08em",
                    flex: 1,
                  }}
                >
                  Points of Interest
                </Typography>
                <Chip
                  label={pois.length}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: "0.7rem",
                    bgcolor: (t) => alpha(t.palette.primary.main, 0.16),
                    color: "primary.main",
                    fontWeight: 600,
                  }}
                />
                <Button
                  size="small"
                  startIcon={placingPoi ? <CloseIcon sx={{ fontSize: 14 }} /> : <AddLocationAltIcon sx={{ fontSize: 14 }} />}
                  onClick={() => (placingPoi ? setPlacingPoi(false) : handleStartPlacingPoi())}
                  color={placingPoi ? "warning" : "primary"}
                  sx={{ textTransform: "none", fontSize: "0.7rem", py: 0.25 }}
                >
                  {placingPoi ? "Cancel" : "Add"}
                </Button>
              </Box>

              <Box sx={{ flex: 1, overflow: "auto", px: 2, pb: 2 }}>
            <List dense disablePadding>
            {pois.length === 0 && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ textAlign: "center", py: 4, px: 2, fontSize: "0.8125rem" }}
              >
                No points of interest yet. Click &ldquo;Add POI&rdquo; then pick a spot on the map.
              </Typography>
            )}
            {pois.map((poi) => (
              <ListItemButton
                key={poi.id}
                selected={poi.id === selectedPoiId}
                onClick={() => handleSelectPoi(poi.id)}
                sx={(t) => ({
                  borderRadius: 1,
                  mb: 0.25,
                  pr: 0.5,
                  "&:hover": { bgcolor: alpha(t.palette.primary.main, 0.08) },
                  "&.Mui-selected": {
                    bgcolor: alpha(t.palette.primary.main, 0.12),
                    "&:hover": { bgcolor: alpha(t.palette.primary.main, 0.16) },
                  },
                })}
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

          {selectedPoi && (
            <>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                <Typography
                  variant="overline"
                  sx={{
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    color: "text.secondary",
                    letterSpacing: "0.08em",
                  }}
                >
                  Edit POI
                </Typography>
              <FormField label="Name">
                <TextField
                  size="small"
                  fullWidth
                  value={selectedPoi.name}
                  onChange={(e) => handleUpdatePoi("name", e.target.value)}
                />
              </FormField>
              <FormField label="Description">
                <TextField
                  size="small"
                  fullWidth
                  multiline
                  rows={2}
                  value={selectedPoi.description ?? ""}
                  onChange={(e) => handleUpdatePoi("description", e.target.value)}
                />
              </FormField>
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
                          : "action.hover",
                        color: selectedPoi.category === cat ? "#fff" : "text.secondary",
                      }}
                    />
                  ))}
                </Box>
              </Box>

              <Divider />

              {/* Linked Building */}
              <Box>
                <Box sx={{ display: "flex", alignItems: "center", mb: 0.75, gap: 0.5 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                    Linked Building
                  </Typography>
                  {selectedPoi.linkedBuilding && (
                    <Button
                      size="small"
                      color="inherit"
                      startIcon={<LinkOffIcon sx={{ fontSize: 14 }} />}
                      onClick={() => {
                        apiRef.current?.poi.update(selectedPoi.id, {
                          linkedBuilding: undefined,
                        });
                        setPois(apiRef.current?.poi.getAll() ?? []);
                      }}
                      sx={{ fontSize: "0.7rem", textTransform: "none", py: 0, opacity: 0.6 }}
                    >
                      Unlink
                    </Button>
                  )}
                </Box>
                {selectedPoi.linkedBuilding ? (
                  <Box
                    sx={{
                      p: 1.25,
                      borderRadius: 1,
                      bgcolor: (t) => alpha(t.palette.primary.main, 0.06),
                      border: "1px solid",
                      borderColor: "divider",
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                    }}
                  >
                    <ApartmentIcon sx={{ fontSize: 20, color: "primary.main" }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        variant="body2"
                        sx={{ fontSize: "0.8125rem", fontWeight: 600 }}
                        noWrap
                      >
                        {selectedPoi.linkedBuilding.label ?? "Building"}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ fontFamily: "monospace", fontSize: "0.7rem", display: "block" }}
                      >
                        {selectedPoi.linkedBuilding.lng.toFixed(5)},{" "}
                        {selectedPoi.linkedBuilding.lat.toFixed(5)}
                      </Typography>
                    </Box>
                  </Box>
                ) : (
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    No building linked. Use the{" "}
                    <ApartmentIcon sx={{ fontSize: 12, verticalAlign: "middle", mx: 0.25 }} />
                    tool on the map to link one.
                  </Typography>
                )}
              </Box>

              <Divider />

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
                  <FormField label="Lng" sx={{ flex: 1 }}>
                    <TextField
                      size="small"
                      fullWidth
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
                  </FormField>
                  <FormField label="Lat" sx={{ flex: 1 }}>
                    <TextField
                      size="small"
                      fullWidth
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
                  </FormField>
                </Stack>
                <FormField label="Altitude (m)">
                  <TextField
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
                </FormField>
              </Box>

              <Divider />

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
                    <FormField label="Zoom" sx={{ flex: 1 }}>
                      <TextField
                        size="small"
                        fullWidth
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
                    </FormField>
                    <FormField label="Pitch" sx={{ flex: 1 }}>
                      <TextField
                        size="small"
                        fullWidth
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
                    </FormField>
                    <FormField label="Bearing" sx={{ flex: 1 }}>
                      <TextField
                        size="small"
                        fullWidth
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
                    </FormField>
                  </Stack>
                ) : (
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    No view saved. Fly-to uses defaults.
                  </Typography>
                )}
              </Box>

              <Divider />

              {/* Events */}
              <Box>
                <Box sx={{ display: "flex", alignItems: "center", mb: 0.75 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                    Events
                  </Typography>
                  <Button
                    size="small"
                    startIcon={<AddIcon sx={{ fontSize: 14 }} />}
                    onClick={() => setEventDialogOpen(true)}
                    sx={{ fontSize: "0.7rem", textTransform: "none", py: 0.25 }}
                  >
                    Add event
                  </Button>
                </Box>
                {(selectedPoi.events ?? []).length === 0 ? (
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    No events. Useful for lectures, open days, tours — surfaces
                    in the public viewer search.
                  </Typography>
                ) : (
                  <Stack spacing={0.75}>
                    {(selectedPoi.events ?? []).map((ev) => (
                      <Box
                        key={ev.id}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          p: 1,
                          border: "1px solid",
                          borderColor: "divider",
                          borderRadius: 1,
                          gap: 1,
                        }}
                      >
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600} noWrap>
                            {ev.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                            {ev.courseCode ? `${ev.courseCode} · ` : ""}
                            {new Date(ev.startsAt).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </Typography>
                        </Box>
                        <IconButton
                          size="small"
                          onClick={() => handleRemoveEvent(selectedPoi.id, ev.id)}
                          sx={{ opacity: 0.5, "&:hover": { opacity: 1 } }}
                        >
                          <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Box>
            </Box>
          </>
        )}
              </Box>
            </>
          )}
        </RightPanelContainer>
      )}

      {/* Add-event dialog */}
      <Dialog
        open={eventDialogOpen}
        onClose={() => setEventDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Add Event</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <FormField label="Title">
              <TextField
                size="small"
                fullWidth
                placeholder="e.g. Introduction to Molecular Biology"
                value={eventForm.title}
                onChange={(e) => setEventForm((f) => ({ ...f, title: e.target.value }))}
              />
            </FormField>
            <Stack direction="row" spacing={1}>
              <FormField label="Course code" sx={{ flex: 1 }}>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="e.g. BIO 101"
                  value={eventForm.courseCode}
                  onChange={(e) => setEventForm((f) => ({ ...f, courseCode: e.target.value }))}
                />
              </FormField>
              <FormField label="Lecturer" sx={{ flex: 1 }}>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="Prof. Παπαδόπουλος"
                  value={eventForm.lecturer}
                  onChange={(e) => setEventForm((f) => ({ ...f, lecturer: e.target.value }))}
                />
              </FormField>
            </Stack>
            <Stack direction="row" spacing={1}>
              <FormField label="Starts" sx={{ flex: 1 }}>
                <TextField
                  size="small"
                  fullWidth
                  type="datetime-local"
                  value={eventForm.startsAt}
                  onChange={(e) => setEventForm((f) => ({ ...f, startsAt: e.target.value }))}
                />
              </FormField>
              <FormField label="Ends" sx={{ flex: 1 }}>
                <TextField
                  size="small"
                  fullWidth
                  type="datetime-local"
                  value={eventForm.endsAt}
                  onChange={(e) => setEventForm((f) => ({ ...f, endsAt: e.target.value }))}
                />
              </FormField>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEventDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAddEvent}
            disabled={!eventForm.title || !eventForm.startsAt}
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}
