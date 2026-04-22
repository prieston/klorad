"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
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
  Tooltip,
  Typography,
} from "@mui/material";
import { createSceneAPI } from "@klorad/api";
import type { CampusAPI, POI, TourStop } from "@klorad/api";
import { useMapboxPoiLayer } from "@/app/hooks/useMapboxPoiLayer";
import { useMapboxFloorPlanLayer } from "@/app/hooks/useMapboxFloorPlanLayer";
import { useMapboxRoute, type RouteMode } from "@/app/hooks/useMapboxRoute";
import LevelSwitcher from "@/app/components/LevelSwitcher";
import WayfindingPanel from "@/app/components/WayfindingPanel";
import {
  TextField,
  SearchIcon,
  CloseIcon,
  LayersIcon,
  TourIcon,
  DirectionsIcon,
} from "@klorad/ui";

const MapboxViewer = dynamic(
  () => import("@klorad/engine-mapbox").then((m) => ({ default: m.MapboxViewer })),
  { ssr: false, loading: () => <MapLoadingFallback /> }
);

function MapLoadingFallback() {
  return (
    <Box sx={{ width: "100vw", height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "background.default" }}>
      <CircularProgress size={32} />
    </Box>
  );
}

interface Props {
  mapId: string;
}

type Panel = "search" | "tour" | "layers" | "wayfind" | null;

export default function PublicViewerClient({ mapId }: Props) {
  const searchParams = useSearchParams();
  const [activePanel, setActivePanel] = useState<Panel>(
    searchParams.get("from") && searchParams.get("to") ? "wayfind" : null
  );
  const [query, setQuery] = useState("");
  const [pois, setPois] = useState<POI[]>([]);
  const [tourStops, setTourStops] = useState<TourStop[]>([]);
  const [currentStop, setCurrentStop] = useState<number>(-1);
  const [sceneReady, setSceneReady] = useState(false);
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null);
  const apiRef = useRef<CampusAPI | null>(null);

  useMapboxPoiLayer({
    pois,
    selectedPoiId,
    onPoiClick: (id) => {
      setSelectedPoiId(id);
      apiRef.current?.poi.flyTo(id);
    },
  });

  const [activeFloor, setActiveFloor] = useState<number | null>(null);
  const [fromId, setFromId] = useState<string | null>(searchParams.get("from"));
  const [toId, setToId] = useState<string | null>(searchParams.get("to"));
  const [routeMode, setRouteMode] = useState<RouteMode>(
    searchParams.get("mode") === "a11y" ? "a11y" : "walk"
  );
  const mapboxToken =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
      : undefined;
  const { route, loading: routeLoading, error: routeError, request: requestRoute, clear: clearRoute } =
    useMapboxRoute(mapboxToken);

  // Fetch route whenever from/to/mode change
  useEffect(() => {
    const from = pois.find((p) => p.id === fromId);
    const to = pois.find((p) => p.id === toId);
    if (!from || !to) {
      clearRoute();
      return;
    }
    requestRoute(
      [from.position[0], from.position[1]],
      [to.position[0], to.position[1]],
      routeMode
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromId, toId, routeMode, pois]);
  const floorPlansForSelection = useMemo(() => {
    if (!apiRef.current || !selectedPoiId) return [];
    return apiRef.current.floorPlans.forBuilding(selectedPoiId);
  }, [selectedPoiId, pois]);
  const activePlan = useMemo(() => {
    if (activeFloor === null) return null;
    return floorPlansForSelection.find((p) => p.floor === activeFloor) ?? null;
  }, [activeFloor, floorPlansForSelection]);
  useMapboxFloorPlanLayer(activePlan);
  useEffect(() => setActiveFloor(null), [selectedPoiId]);

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

      {floorPlansForSelection.length > 0 && (
        <LevelSwitcher
          plans={floorPlansForSelection}
          activeFloor={activeFloor}
          onSelectFloor={setActiveFloor}
        />
      )}

      {/* Floating controls */}
      <Box
        sx={{
          position: "absolute",
          top: 16,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 1,
          bgcolor: "var(--glass-bg)",
          backdropFilter: "blur(8px)",
          border: "1px solid var(--glass-border)",
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
        <Tooltip title="Directions">
          <IconButton size="small" onClick={() => togglePanel("wayfind")} color={activePanel === "wayfind" ? "primary" : "default"}>
            <DirectionsIcon fontSize="small" />
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
            bgcolor: "var(--glass-bg)",
            backdropFilter: "blur(12px)",
            border: "none",
            borderRight: "1px solid var(--glass-border)",
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

      {/* Wayfinding panel */}
      {activePanel === "wayfind" && (
        <WayfindingPanel
          pois={pois}
          fromId={fromId}
          toId={toId}
          mode={routeMode}
          route={route}
          loading={routeLoading}
          error={routeError}
          onChangeFrom={setFromId}
          onChangeTo={setToId}
          onChangeMode={setRouteMode}
          onClose={() => setActivePanel(null)}
        />
      )}

      {/* Tour panel */}
      {activePanel === "tour" && tourStops.length > 0 && (
        <Box
          sx={{
            position: "absolute",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            bgcolor: "var(--glass-bg)",
            backdropFilter: "blur(8px)",
            border: "1px solid var(--glass-border)",
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
