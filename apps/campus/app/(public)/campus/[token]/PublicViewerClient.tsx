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
  useMediaQuery,
} from "@mui/material";
import { createSceneAPI } from "@klorad/api";
import type { CampusAPI, POI, TourStop } from "@klorad/api";
import { useMapboxPoiLayer } from "@/app/hooks/useMapboxPoiLayer";
import { useMapboxFloorPlanLayer } from "@/app/hooks/useMapboxFloorPlanLayer";
import { useMapboxRoute, type RouteMode } from "@/app/hooks/useMapboxRoute";
import LevelSwitcher from "@/app/components/LevelSwitcher";
import WayfindingPanel from "@/app/components/WayfindingPanel";
import WhereAmIButton from "@/app/components/WhereAmIButton";
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
  const isMobile = useMediaQuery("(max-width:768px)");
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

  // Fetch route whenever from/to/mode change. If a POI is linked to a
  // Mapbox building, route to/from that building's footprint — matches
  // where the POI pin is visually rendered.
  useEffect(() => {
    const from = pois.find((p) => p.id === fromId);
    const to = pois.find((p) => p.id === toId);
    if (!from || !to) {
      clearRoute();
      return;
    }
    const fromCoord: [number, number] = [
      from.linkedBuilding?.lng ?? from.position[0],
      from.linkedBuilding?.lat ?? from.position[1],
    ];
    const toCoord: [number, number] = [
      to.linkedBuilding?.lng ?? to.position[0],
      to.linkedBuilding?.lat ?? to.position[1],
    ];
    requestRoute(fromCoord, toCoord, routeMode);
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

  // Query text ranked by the CampusAPI (also covers event titles + course codes)
  const filteredPois = useMemo(() => {
    if (!query.trim() || !apiRef.current) return pois;
    return apiRef.current.poi.search(query);
  }, [query, pois]);

  // For each matching POI, also surface its events that match the query
  // so "Bio 101" can select the room AND surface the live lecture card.
  const matchedEvents = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return new Map<string, string | null>();
    const out = new Map<string, string | null>();
    for (const poi of filteredPois) {
      const ev = (poi.events ?? []).find(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.courseCode?.toLowerCase().includes(q) ||
          e.lecturer?.toLowerCase().includes(q)
      );
      out.set(poi.id, ev?.id ?? null);
    }
    return out;
  }, [filteredPois, query]);

  // Chained search-to-event reveal — the flagship demo moment.
  // 1) Select & fly to the POI (fires the POI highlight + existing fly
  //    animation).
  // 2) If the POI sits on a specific floor AND that floor has a plan,
  //    after the fly-to settles activate the floor (Roof Lift).
  // 3) If the POI has an event that matched the query, highlight it in
  //    the search result card (already shown inline — see event card
  //    rendering below).
  const revealPoiAndEvent = (poi: POI) => {
    setSelectedPoiId(poi.id);
    apiRef.current?.poi.flyTo(poi.id);
    // Time the floor activation to land just after the fly settles
    // (our flyTo is ~1800ms; kick the floor slightly later).
    if (typeof poi.floor === "number" && apiRef.current) {
      const buildingId = poi.linkedBuilding?.featureId
        ? String(poi.linkedBuilding.featureId)
        : poi.id;
      const plan = apiRef.current.floorPlans
        .forBuilding(buildingId)
        .find((p) => p.floor === poi.floor);
      if (plan) {
        setTimeout(() => setActiveFloor(plan.floor ?? 0), 1400);
      }
    }
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

      {/* Where-am-I FAB. On mobile, sits above the bottom pill of controls. */}
      <WhereAmIButton
        right={16}
        bottom={isMobile ? 88 : 16}
        size={isMobile ? 56 : 52}
      />

      {/* Floating controls — top-center on desktop, bottom thumb-zone on mobile */}
      <Box
        sx={{
          position: "absolute",
          ...(isMobile
            ? { bottom: 16, left: "50%", transform: "translateX(-50%)" }
            : { top: 16, left: "50%", transform: "translateX(-50%)" }),
          display: "flex",
          gap: 1,
          bgcolor: "var(--glass-bg)",
          backdropFilter: "blur(8px)",
          border: "1px solid var(--glass-border)",
          borderRadius: 8,
          px: 1.5,
          py: 0.75,
          zIndex: 1401,
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

      {/* Search panel — left drawer on desktop, bottom sheet on mobile */}
      <Drawer
        anchor={isMobile ? "bottom" : "left"}
        open={activePanel === "search"}
        onClose={() => setActivePanel(null)}
        variant={isMobile ? "temporary" : "persistent"}
        ModalProps={{ keepMounted: true }}
        sx={
          isMobile
            ? {
                "& .MuiDrawer-paper": {
                  height: "72vh",
                  bottom: 0,
                  top: "auto",
                  borderTopLeftRadius: 16,
                  borderTopRightRadius: 16,
                  bgcolor: "var(--glass-bg)",
                  backdropFilter: "blur(12px)",
                  border: "none",
                  borderTop: "1px solid var(--glass-border)",
                },
              }
            : {
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
              }
        }
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
            {filteredPois.map((poi) => {
              const matchedEventId = matchedEvents.get(poi.id);
              const event = matchedEventId
                ? poi.events?.find((e) => e.id === matchedEventId)
                : null;
              return (
              <Box
                key={poi.id}
                sx={{
                  borderRadius: 1,
                  mb: 0.5,
                  overflow: "hidden",
                  border: event ? "1px solid" : "none",
                  borderColor: "primary.main",
                }}
              >
                <ListItemButton
                  onClick={() => revealPoiAndEvent(poi)}
                  sx={{ borderRadius: 0, py: 0.75 }}
                >
                  <ListItemText
                    primary={poi.name}
                    secondary={
                      typeof poi.floor === "number"
                        ? `${poi.category ?? "POI"} · Floor ${poi.floor === 0 ? "Γ" : poi.floor}`
                        : poi.category
                    }
                    primaryTypographyProps={{ fontSize: "0.875rem" }}
                    secondaryTypographyProps={{ fontSize: "0.75rem" }}
                  />
                </ListItemButton>
                {event && (
                  <Box
                    sx={{
                      px: 2,
                      py: 1,
                      bgcolor: "rgba(107,156,216,0.08)",
                      borderTop: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    <Typography variant="caption" color="primary.main" sx={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      Happening {isHappeningNow(event) ? "Now" : formatWhen(event)}
                    </Typography>
                    <Typography variant="body2" fontWeight={600} sx={{ fontSize: "0.8125rem" }}>
                      {event.title}
                    </Typography>
                    {(event.courseCode || event.lecturer) && (
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem", display: "block" }}>
                        {[event.courseCode, event.lecturer].filter(Boolean).join(" · ")}
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>
              );
            })}
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
          onClear={() => {
            setFromId(null);
            setToId(null);
            clearRoute();
          }}
          onClose={() => setActivePanel(null)}
        />
      )}

      {/* Tour panel */}
      {activePanel === "tour" && tourStops.length > 0 && (
        <Box
          sx={{
            position: "absolute",
            bgcolor: "var(--glass-bg)",
            backdropFilter: "blur(8px)",
            border: "1px solid var(--glass-border)",
            borderRadius: 2,
            p: 2,
            zIndex: 1400,
            // Desktop: floating bottom-center. Mobile: stretch above the pill.
            bottom: { xs: 88, md: 24 },
            left: { xs: 16, md: "50%" },
            right: { xs: 16, md: "auto" },
            transform: { xs: "none", md: "translateX(-50%)" },
            width: { xs: "auto", md: 380 },
            maxWidth: { md: "90vw" },
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

function isHappeningNow(event: { startsAt: string; endsAt: string }): boolean {
  const now = Date.now();
  const s = Date.parse(event.startsAt);
  const e = Date.parse(event.endsAt);
  return now >= s && now <= e;
}

function formatWhen(event: { startsAt: string }): string {
  const d = new Date(event.startsAt);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `today at ${time}`;
  const dateLabel = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${dateLabel} at ${time}`;
}
