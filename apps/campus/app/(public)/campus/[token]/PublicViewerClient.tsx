"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import {
  Box,
  Chip,
  CircularProgress,
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
import type { Branding, CampusAPI, POI, SceneData, TourStop } from "@klorad/api";
import { ThemeProvider, createTheme, useTheme } from "@mui/material/styles";
import { useMapboxPoiLayer } from "@/app/hooks/useMapboxPoiLayer";
import { useMapboxFloorPlanLayer } from "@/app/hooks/useMapboxFloorPlanLayer";
import { useMapboxRoomsLayer } from "@/app/hooks/useMapboxRoomsLayer";
import { useMapboxDrawnBuildingsLayer } from "@/app/hooks/useMapboxDrawnBuildingsLayer";
import { useMapboxFloorSlabsLayer } from "@/app/hooks/useMapboxFloorSlabsLayer";
import {
  useCampusLabelDefaults,
  withCampusLabelDefaults,
} from "@/app/hooks/useCampusLabelDefaults";
import { getRoomTemplate } from "@/app/lib/roomTemplates";
import type { Room } from "@klorad/api";
import { useMapboxRoute, type RouteMode } from "@/app/hooks/useMapboxRoute";
import WayfindingPanel, { MY_LOCATION_ID } from "@/app/components/WayfindingPanel";
import WhereAmIButton from "@/app/components/WhereAmIButton";
import BrandedHeader from "@/app/components/BrandedHeader";
import LocaleToggle from "@/app/components/LocaleToggle";
import { LocaleProvider, detectLocale, useT, type Locale } from "@/app/lib/i18n";
import {
  TextField,
  SearchIcon,
  TourIcon,
  DirectionsIcon,
  ArrowBackIcon,
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
  /** The campus's stored `sceneData.defaultLocale`, threaded through
   *  from the server page so a fresh visit with no `?lang=` matches
   *  the rector's chosen default instead of the platform fallback. */
  defaultLocale?: Locale | null;
}

type Section = "home" | "directions" | "tour";

export default function PublicViewerClient({
  mapId,
  defaultLocale,
}: Props) {
  const searchParams = useSearchParams();
  const initialLocale: Locale = detectLocale(
    searchParams.get("lang"),
    defaultLocale,
  );
  return (
    <LocaleProvider initial={initialLocale}>
      <PublicViewerInner mapId={mapId} />
    </LocaleProvider>
  );
}

function PublicViewerInner({ mapId }: Props) {
  const searchParams = useSearchParams();
  const isMobile = useMediaQuery("(max-width:768px)");
  const t = useT();
  const [activeSection, setActiveSection] = useState<Section>(
    searchParams.get("from") && searchParams.get("to") ? "directions" : "home"
  );
  // Mobile-only: bottom-sheet snap state. true = full, false = peek.
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [pois, setPois] = useState<POI[]>([]);
  const [tourStops, setTourStops] = useState<TourStop[]>([]);
  const [currentStop, setCurrentStop] = useState<number>(-1);
  const [sceneReady, setSceneReady] = useState(false);
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null);
  const [branding, setBranding] = useState<Branding>({});
  const apiRef = useRef<CampusAPI | null>(null);

  useMapboxPoiLayer({
    pois,
    selectedPoiId,
    onPoiClick: (id) => {
      setSelectedPoiId(id);
      apiRef.current?.poi.flyTo(id);
    },
  });

  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [fromId, setFromId] = useState<string | null>(searchParams.get("from"));
  const [toId, setToId] = useState<string | null>(searchParams.get("to"));
  const [routeMode, setRouteMode] = useState<RouteMode>(
    searchParams.get("mode") === "a11y" ? "a11y" : "walk"
  );
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const requestUserLocation = () => {
    if (userLocation) return Promise.resolve(userLocation);
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setLocationError("unsupported");
      return Promise.resolve(null);
    }
    setLocating(true);
    setLocationError(null);
    return new Promise<[number, number] | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coord: [number, number] = [pos.coords.longitude, pos.coords.latitude];
          setUserLocation(coord);
          setLocating(false);
          resolve(coord);
        },
        (err) => {
          setLocationError(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable");
          setLocating(false);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  };

  const handleFromChange = (id: string | null) => {
    setFromId(id);
    if (id === MY_LOCATION_ID && !userLocation) void requestUserLocation();
  };
  const handleToChange = (id: string | null) => {
    setToId(id);
    if (id === MY_LOCATION_ID && !userLocation) void requestUserLocation();
  };
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
    const resolveCoord = (id: string | null): [number, number] | null => {
      if (!id) return null;
      if (id === MY_LOCATION_ID) return userLocation;
      const p = pois.find((x) => x.id === id);
      if (!p) return null;
      return [
        p.linkedBuilding?.lng ?? p.position[0],
        p.linkedBuilding?.lat ?? p.position[1],
      ];
    };
    const fromCoord = resolveCoord(fromId);
    const toCoord = resolveCoord(toId);
    if (!fromCoord || !toCoord) {
      clearRoute();
      return;
    }
    requestRoute(fromCoord, toCoord, routeMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromId, toId, routeMode, pois, userLocation]);
  const floorPlansForSelection = useMemo(() => {
    if (!apiRef.current || !selectedPoiId) return [];
    return apiRef.current.floorPlans.forBuilding(selectedPoiId);
  }, [selectedPoiId, pois]);
  const activePlan = useMemo(() => {
    if (!activePlanId) return null;
    return floorPlansForSelection.find((p) => p.id === activePlanId) ?? null;
  }, [activePlanId, floorPlansForSelection]);
  useMapboxFloorPlanLayer(activePlan);
  useCampusLabelDefaults(sceneReady);
  useEffect(() => setActivePlanId(null), [selectedPoiId]);

  // Rooms for the selected building
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const roomsForSelection = useMemo<Room[]>(() => {
    if (!apiRef.current || !selectedPoiId) return [];
    return apiRef.current.rooms.forBuilding(selectedPoiId);
  }, [selectedPoiId, pois]);
  const activeRoom = useMemo<Room | null>(() => {
    if (!activeRoomId) return null;
    return roomsForSelection.find((r) => r.id === activeRoomId) ?? null;
  }, [activeRoomId, roomsForSelection]);
  // Render every drawn building. Clipping mirrors the Studio:
  // selected building shows up to active floor; others render whole.
  const allPlansViewer = apiRef.current?.floorPlans.getAll() ?? [];
  const allRoomsViewer = apiRef.current?.rooms.getAll() ?? [];
  useMapboxDrawnBuildingsLayer(pois, allPlansViewer, allRoomsViewer, {
    selectedPoiId,
    activeFloor: activePlan?.floor ?? null,
    onSelect: (id) => setSelectedPoiId(id),
  });
  useMapboxFloorSlabsLayer(pois, allPlansViewer, allRoomsViewer, {
    activePlanId,
    selectedBuildingPoiId: selectedPoiId,
    onSelect: (buildingId, _floor, planId) => {
      setSelectedPoiId(buildingId);
      if (planId) setActivePlanId(planId);
    },
  });

  useMapboxRoomsLayer(roomsForSelection, {
    activeFloor: activePlan?.floor ?? null,
    onSelect: (id) => setActiveRoomId(id),
    highlightRoomId: activeRoomId,
  });
  useEffect(() => setActiveRoomId(null), [selectedPoiId, activePlanId]);

  // Selecting a building / room on the map flips the panel to the
  // Home section (where the drill-down lives) and snaps it to full on
  // mobile so the visitor sees the detail view immediately.
  useEffect(() => {
    if (!selectedPoiId && !activeRoomId) return;
    setActiveSection("home");
    setPanelExpanded(true);
  }, [selectedPoiId, activeRoomId]);

  // All rooms — used for global room search across buildings.
  const allRoomsForSearch = useMemo<Room[]>(() => {
    if (!apiRef.current) return [];
    return apiRef.current.rooms.getAll();
  }, [pois, sceneReady]);

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
        const sceneToLoad = withCampusLabelDefaults(data?.sceneData ?? {});
        api.load(sceneToLoad);
        const scene = (data?.sceneData ?? {}) as Partial<SceneData>;
        if (scene.branding) setBranding(scene.branding);
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

  // Same query against rooms — name, room number, and occupant names so
  // "Bio 101" or "Dr. Papadopoulos" find their room.
  const filteredRooms = useMemo<Room[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return allRoomsForSearch.filter((r) => {
      if (r.name?.toLowerCase().includes(q)) return true;
      if (r.roomNumber?.toLowerCase().includes(q)) return true;
      if (r.occupants?.some((o) => o.name?.toLowerCase().includes(q))) return true;
      if (r.searchKeywords?.some((k) => k.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [query, allRoomsForSearch]);

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
        setTimeout(() => setActivePlanId(plan.id), 1400);
      }
    }
  };

  const switchSection = (section: Section) => {
    setActiveSection(section);
    setPanelExpanded(true);
  };

  const selectedPoi = useMemo(
    () => (selectedPoiId ? pois.find((p) => p.id === selectedPoiId) ?? null : null),
    [selectedPoiId, pois]
  );

  const sortedFloorsForBuilding = useMemo(
    () => [...floorPlansForSelection].sort((a, b) => (a.floor ?? 0) - (b.floor ?? 0)),
    [floorPlansForSelection]
  );

  // Inner-view derivation. The drawer header + body switch on this:
  //   list     — search and pick anything
  //   building — building name + clickable floors
  //   room     — room details + back to its building
  const panelView: "list" | "building" | "room" =
    activeRoom ? "room" : selectedPoi ? "building" : "list";

  const goToBuilding = (poi: POI) => {
    setActiveRoomId(null);
    setActivePlanId(null);
    setSelectedPoiId(poi.id);
    apiRef.current?.poi.flyTo(poi.id);
  };

  const goToRoom = (room: Room) => {
    setSelectedPoiId(room.buildingId);
    const plan = apiRef.current?.floorPlans
      .forBuilding(room.buildingId)
      .find((p) => p.floor === room.floor);
    setActivePlanId(plan?.id ?? null);
    setActiveRoomId(room.id);
    apiRef.current?.poi.flyTo(room.buildingId);
  };

  // Deep link in — focus the building / floor / room named by the
  // `?place` URL param once the scene has loaded. A building, floor
  // or room id is accepted; each resolves to its place + camera fly.
  const deepLinkedRef = useRef(false);
  useEffect(() => {
    if (!sceneReady || deepLinkedRef.current) return;
    const api = apiRef.current;
    const placeId = searchParams.get("place");
    if (!api || !placeId) return;
    deepLinkedRef.current = true;

    const poi = api.poi.getAll().find((p) => p.id === placeId);
    if (poi) {
      goToBuilding(poi);
      return;
    }
    const room = api.rooms.getAll().find((r) => r.id === placeId);
    if (room) {
      goToRoom(room);
      return;
    }
    const plan = api.floorPlans.getAll().find((fp) => fp.id === placeId);
    if (plan) {
      const building = api.poi.getAll().find((p) => p.id === plan.buildingId);
      if (building) {
        goToBuilding(building);
        // Activate the floor once the fly-to settles (~1800ms).
        window.setTimeout(() => setActivePlanId(plan.id), 1400);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneReady]);

  // Deep link out — mirror the current selection into `?place` so the
  // address bar is always a shareable link to what's on screen.
  useEffect(() => {
    if (!sceneReady) return;
    const placeId = activeRoomId ?? activePlanId ?? selectedPoiId;
    const url = new URL(window.location.href);
    if (placeId) url.searchParams.set("place", placeId);
    else url.searchParams.delete("place");
    window.history.replaceState(null, "", url);
  }, [sceneReady, selectedPoiId, activePlanId, activeRoomId]);

  const backFromBuilding = () => {
    setSelectedPoiId(null);
    setActivePlanId(null);
    setActiveRoomId(null);
  };

  const backFromRoom = () => {
    setActiveRoomId(null);
  };

  const goToStop = (idx: number) => {
    apiRef.current?.tour.goTo(idx);
    setCurrentStop(idx);
  };

  return (
    <BrandingScope primaryColor={branding.primaryColor}>
    <Box sx={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden" }}>
      {sceneReady ? <MapboxViewer /> : <MapLoadingFallback />}

      <BrandedHeader logo={branding.logo} alt={branding.name ?? "Logo"} />

      {/* Where-am-I FAB. Hidden behind the panel when the bottom sheet
          is fully expanded on mobile. */}
      {!(isMobile && panelExpanded) && (
        <WhereAmIButton
          right={16}
          bottom={isMobile ? 112 : 16}
          size={isMobile ? 56 : 52}
        />
      )}

      {/* The single navigation panel — docked left on desktop / tablet,
          a non-modal bottom sheet on mobile (peek vs full). Folds in
          everything that used to float: section tabs, locale toggle,
          search, building / floor / room drill-down, directions, tour. */}
      <Box
        sx={{
          position: "absolute",
          zIndex: 1400,
          bgcolor: "var(--glass-bg)",
          backdropFilter: "blur(24px) saturate(140%)",
          WebkitBackdropFilter: "blur(24px) saturate(140%)",
          border: "1px solid var(--glass-border)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.32)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          transition: "height 220ms ease",
          ...(isMobile
            ? {
                left: 8,
                right: 8,
                bottom: 8,
                height: panelExpanded ? "82vh" : 116,
                borderRadius: "16px",
              }
            : {
                left: 16,
                top: 16,
                bottom: 16,
                width: 360,
                borderRadius: 2,
              }),
        }}
      >
        {/* Mobile drag-handle — tap to toggle peek/full. */}
        {isMobile && (
          <Box
            role="button"
            aria-label={panelExpanded ? "Collapse panel" : "Expand panel"}
            onClick={() => setPanelExpanded((p) => !p)}
            sx={{
              display: "flex",
              justifyContent: "center",
              py: 0.75,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <Box
              sx={{
                width: 36,
                height: 4,
                borderRadius: 2,
                bgcolor: "rgba(148,163,184,0.6)",
              }}
            />
          </Box>
        )}

        {/* Header — section tabs + locale toggle */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            px: 1.25,
            py: 0.75,
            borderBottom: "1px solid",
            borderColor: "divider",
            flexShrink: 0,
          }}
        >
          <Tooltip title={t("toolbar.search")}>
            <IconButton
              size="small"
              onClick={() => switchSection("home")}
              color={activeSection === "home" ? "primary" : "default"}
            >
              <SearchIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t("toolbar.directions")}>
            <IconButton
              size="small"
              onClick={() => switchSection("directions")}
              color={activeSection === "directions" ? "primary" : "default"}
            >
              <DirectionsIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {tourStops.length > 0 && (
            <Tooltip title={t("toolbar.tour")}>
              <IconButton
                size="small"
                onClick={() => switchSection("tour")}
                color={activeSection === "tour" ? "primary" : "default"}
              >
                <TourIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Box sx={{ flex: 1 }} />
          <LocaleToggle />
        </Box>

        {/* Body — Home (search / building / room) */}
        <Box
          sx={{
            flex: 1,
            overflowY: "auto",
            display: activeSection === "home" ? "block" : "none",
            p: 2,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", mb: 2, gap: 0.5 }}>
            {panelView !== "list" && (
              <IconButton
                size="small"
                onClick={panelView === "room" ? backFromRoom : backFromBuilding}
              >
                <ArrowBackIcon fontSize="small" />
              </IconButton>
            )}
            <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1 }}>
              {panelView === "room"
                ? activeRoom?.name
                : panelView === "building"
                  ? selectedPoi?.name
                  : t("search.title")}
            </Typography>
          </Box>

          {panelView === "list" && (
            <>
              <TextField
                fullWidth
                size="small"
                placeholder={t("search.placeholder")}
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
                        onClick={() => {
                          if (query.trim()) revealPoiAndEvent(poi);
                          else goToBuilding(poi);
                        }}
                        sx={{ borderRadius: 0, py: 0.75 }}
                      >
                        <ListItemText
                          primary={poi.name}
                          secondary={
                            typeof poi.floor === "number"
                              ? `${poi.category ?? "POI"} · ${t("search.floor")} ${poi.floor === 0 ? "Γ" : poi.floor}`
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
                            {isHappeningNow(event)
                              ? t("search.happeningNow")
                              : `${t("search.happeningSoon")} · ${formatWhen(event, t)}`}
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
                {filteredRooms.map((r) => {
                  const tpl = getRoomTemplate(r.type);
                  const building = pois.find((p) => p.id === r.buildingId);
                  return (
                    <ListItemButton
                      key={`room-${r.id}`}
                      onClick={() => goToRoom(r)}
                      sx={{ borderRadius: 1, py: 0.75, mb: 0.5 }}
                    >
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          bgcolor: tpl.color,
                          mr: 1.25,
                          flexShrink: 0,
                        }}
                      />
                      <ListItemText
                        primary={r.name}
                        secondary={`${tpl.label}${r.roomNumber ? ` · ${r.roomNumber}` : ""}${building ? ` · ${building.name}` : ""} · ${t("search.floor")} ${r.floor === 0 ? "Γ" : r.floor}`}
                        primaryTypographyProps={{ fontSize: "0.875rem" }}
                        secondaryTypographyProps={{ fontSize: "0.75rem" }}
                      />
                    </ListItemButton>
                  );
                })}
                {query &&
                  filteredPois.length === 0 &&
                  filteredRooms.length === 0 && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ py: 2, textAlign: "center" }}
                    >
                      {t("search.noResults", { query })}
                    </Typography>
                  )}
              </List>
            </>
          )}

          {panelView === "building" && selectedPoi && (
            <Box>
              {selectedPoi.category && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    fontSize: "0.7rem",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    display: "block",
                    mb: 1.5,
                  }}
                >
                  {selectedPoi.category}
                </Typography>
              )}
              <Typography
                variant="overline"
                sx={{ fontSize: "0.7rem", fontWeight: 600, color: "text.secondary" }}
              >
                Floors
              </Typography>
              {sortedFloorsForBuilding.length === 0 ? (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ py: 2, fontSize: "0.8125rem" }}
                >
                  No floors yet.
                </Typography>
              ) : (
                <List dense sx={{ mt: 0.5 }}>
                  {sortedFloorsForBuilding.map((plan) => {
                    const isActive = plan.id === activePlanId;
                    return (
                      <ListItemButton
                        key={plan.id}
                        onClick={() =>
                          setActivePlanId(isActive ? null : plan.id)
                        }
                        selected={isActive}
                        sx={{ borderRadius: 1, py: 0.75, mb: 0.5 }}
                      >
                        <ListItemText
                          primary={
                            plan.name?.trim() ||
                            (plan.floor === 0
                              ? "Ground floor"
                              : (plan.floor ?? 0) < 0
                                ? `Basement ${Math.abs(plan.floor ?? 0)}`
                                : `Floor ${plan.floor}`)
                          }
                          secondary={
                            isActive
                              ? `${roomsForSelection.filter((r) => r.floor === plan.floor).length} rooms · tap to hide`
                              : `${roomsForSelection.filter((r) => r.floor === plan.floor).length} rooms`
                          }
                          primaryTypographyProps={{ fontSize: "0.875rem" }}
                          secondaryTypographyProps={{ fontSize: "0.75rem" }}
                        />
                      </ListItemButton>
                    );
                  })}
                </List>
              )}
              {activePlan && (
                <>
                  <Typography
                    variant="overline"
                    sx={{ fontSize: "0.7rem", fontWeight: 600, color: "text.secondary", mt: 1.5, display: "block" }}
                  >
                    Rooms on this floor
                  </Typography>
                  <List dense sx={{ mt: 0.5 }}>
                    {roomsForSelection
                      .filter((r) => r.floor === activePlan.floor)
                      .map((r) => {
                        const tpl = getRoomTemplate(r.type);
                        return (
                          <ListItemButton
                            key={r.id}
                            onClick={() => goToRoom(r)}
                            sx={{ borderRadius: 1, py: 0.75, mb: 0.5 }}
                          >
                            <Box
                              sx={{
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                bgcolor: tpl.color,
                                mr: 1.25,
                                flexShrink: 0,
                              }}
                            />
                            <ListItemText
                              primary={r.name}
                              secondary={
                                r.roomNumber
                                  ? `${tpl.label} · ${r.roomNumber}`
                                  : tpl.label
                              }
                              primaryTypographyProps={{ fontSize: "0.875rem" }}
                              secondaryTypographyProps={{ fontSize: "0.75rem" }}
                            />
                          </ListItemButton>
                        );
                      })}
                  </List>
                </>
              )}
            </Box>
          )}

          {panelView === "room" && activeRoom && (
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    bgcolor: getRoomTemplate(activeRoom.type).color,
                  }}
                />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    fontSize: "0.7rem",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                >
                  {getRoomTemplate(activeRoom.type).label}
                  {activeRoom.roomNumber ? ` · ${activeRoom.roomNumber}` : ""}
                  {` · ${t("search.floor")} ${activeRoom.floor === 0 ? "Γ" : activeRoom.floor}`}
                </Typography>
              </Box>
              {selectedPoi && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  {selectedPoi.name}
                </Typography>
              )}
              {activeRoom.occupants && activeRoom.occupants.length > 0 && (
                <>
                  <Typography
                    variant="overline"
                    sx={{ fontSize: "0.7rem", fontWeight: 600, color: "text.secondary" }}
                  >
                    Occupants
                  </Typography>
                  <Box sx={{ mt: 0.5 }}>
                    {activeRoom.occupants.map((o, i) => (
                      <Box key={i} sx={{ mb: 1 }}>
                        <Typography variant="body2" fontWeight={600}>
                          {o.name}
                        </Typography>
                        {o.role && (
                          <Typography variant="caption" color="text.secondary">
                            {o.role}
                          </Typography>
                        )}
                      </Box>
                    ))}
                  </Box>
                </>
              )}
              {activeRoom.searchKeywords &&
                activeRoom.searchKeywords.length > 0 && (
                  <>
                    <Typography
                      variant="overline"
                      sx={{
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        color: "text.secondary",
                        mt: 1.5,
                        display: "block",
                      }}
                    >
                      Also known as
                    </Typography>
                    <Box sx={{ mt: 0.5, display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                      {activeRoom.searchKeywords.map((k) => (
                        <Chip
                          key={k}
                          label={k}
                          size="small"
                          sx={{ fontSize: "0.7rem", height: 22 }}
                        />
                      ))}
                    </Box>
                  </>
                )}
            </Box>
          )}
        </Box>

        {/* Body — Directions */}
        <Box
          sx={{
            flex: 1,
            overflowY: "auto",
            display: activeSection === "directions" ? "block" : "none",
            p: 2,
          }}
        >
          <Typography
            variant="subtitle2"
            fontWeight={700}
            sx={{ mb: 1.5 }}
          >
            {t("wayfind.title")}
          </Typography>
          <WayfindingPanel
            variant="embedded"
            pois={pois}
            fromId={fromId}
            toId={toId}
            mode={routeMode}
            route={route}
            loading={routeLoading}
            error={
              routeError ||
              (locationError === "denied"
                ? t("wayfind.locationDenied")
                : locationError === "unsupported"
                  ? t("wayfind.locationUnsupported")
                  : null)
            }
            locating={locating}
            onChangeFrom={handleFromChange}
            onChangeTo={handleToChange}
            onChangeMode={setRouteMode}
            onClear={() => {
              setFromId(null);
              setToId(null);
              clearRoute();
            }}
          />
        </Box>

        {/* Body — Tour */}
        {tourStops.length > 0 && (
          <Box
            sx={{
              flex: 1,
              overflowY: "auto",
              display: activeSection === "tour" ? "block" : "none",
              p: 2,
            }}
          >
            <Typography
              variant="subtitle2"
              fontWeight={700}
              sx={{ mb: 1.5 }}
            >
              {t("tour.title")}
            </Typography>
            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mb: 1.5 }}>
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
    </Box>
    </BrandingScope>
  );
}

/**
 * Wraps children in a themed MUI ThemeProvider that overrides the
 * primary color when the campus has provided a brand color. No-op
 * (returns children as-is) when no override is set.
 */
function BrandingScope({
  primaryColor,
  children,
}: {
  primaryColor?: string;
  children: React.ReactNode;
}) {
  const parent = useTheme();
  if (!primaryColor || !isValidHex(primaryColor)) return <>{children}</>;
  const branded = createTheme({
    ...parent,
    palette: {
      ...parent.palette,
      primary: { ...parent.palette.primary, main: primaryColor },
    },
  });
  return <ThemeProvider theme={branded}>{children}</ThemeProvider>;
}

function isValidHex(v: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim());
}

function isHappeningNow(event: { startsAt: string; endsAt: string }): boolean {
  const now = Date.now();
  const s = Date.parse(event.startsAt);
  const e = Date.parse(event.endsAt);
  return now >= s && now <= e;
}

function formatWhen(
  event: { startsAt: string },
  t: (key: "search.today" | "search.onDay", vars?: Record<string, string | number>) => string
): string {
  const d = new Date(event.startsAt);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return t("search.today", { time });
  const dateLabel = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return t("search.onDay", { date: dateLabel, time });
}
