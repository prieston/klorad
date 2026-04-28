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
import type { Branding, CampusAPI, POI, SceneData, TourStop } from "@klorad/api";
import { ThemeProvider, createTheme, useTheme } from "@mui/material/styles";
import { useMapboxPoiLayer } from "@/app/hooks/useMapboxPoiLayer";
import { useMapboxFloorPlanLayer } from "@/app/hooks/useMapboxFloorPlanLayer";
import { useMapboxRoomsLayer } from "@/app/hooks/useMapboxRoomsLayer";
import {
  useCampusLabelDefaults,
  withCampusLabelDefaults,
} from "@/app/hooks/useCampusLabelDefaults";
import { getRoomTemplate } from "@/app/lib/roomTemplates";
import type { Room } from "@klorad/api";
import { useMapboxRoute, type RouteMode } from "@/app/hooks/useMapboxRoute";
import LevelSwitcher from "@/app/components/LevelSwitcher";
import WayfindingPanel, { MY_LOCATION_ID } from "@/app/components/WayfindingPanel";
import WhereAmIButton from "@/app/components/WhereAmIButton";
import BrandedHeader from "@/app/components/BrandedHeader";
import LocaleToggle from "@/app/components/LocaleToggle";
import { LocaleProvider, detectLocale, useT, type Locale } from "@/app/lib/i18n";
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
  const initialLocale: Locale = detectLocale(searchParams.get("lang"));
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
  const [activePanel, setActivePanel] = useState<Panel>(
    searchParams.get("from") && searchParams.get("to") ? "wayfind" : null
  );
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
  useMapboxRoomsLayer(roomsForSelection, {
    activeFloor: activePlan?.floor ?? null,
    onSelect: (id) => setActiveRoomId(id),
    highlightRoomId: activeRoomId,
  });
  useEffect(() => setActiveRoomId(null), [selectedPoiId, activePlanId]);

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

  const togglePanel = (panel: Panel) =>
    setActivePanel((prev) => (prev === panel ? null : panel));

  const goToStop = (idx: number) => {
    apiRef.current?.tour.goTo(idx);
    setCurrentStop(idx);
  };

  return (
    <BrandingScope primaryColor={branding.primaryColor}>
    <Box sx={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden" }}>
      {sceneReady ? <MapboxViewer /> : <MapLoadingFallback />}

      <BrandedHeader logo={branding.logo} alt={branding.name ?? "Logo"} />

      {floorPlansForSelection.length > 0 && (
        <LevelSwitcher
          plans={floorPlansForSelection}
          activePlanId={activePlanId}
          onSelectPlan={setActivePlanId}
        />
      )}

      {activeRoom && (
        <Box
          sx={{
            position: "absolute",
            left: { xs: 16, md: 16 },
            right: { xs: 16, md: "auto" },
            bottom: { xs: 88, md: 16 },
            width: { xs: "auto", md: 340 },
            zIndex: 1400,
            bgcolor: "var(--glass-bg)",
            border: "1px solid var(--glass-border)",
            backdropFilter: "blur(24px) saturate(140%)",
            WebkitBackdropFilter: "blur(24px) saturate(140%)",
            borderRadius: 2,
            p: 2,
            boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                bgcolor: getRoomTemplate(activeRoom.type).color,
              }}
            />
            <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1 }}>
              {activeRoom.name}
            </Typography>
            <IconButton size="small" onClick={() => setActiveRoomId(null)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontSize: "0.7rem", letterSpacing: "0.06em", textTransform: "uppercase" }}
          >
            {getRoomTemplate(activeRoom.type).label}
            {activeRoom.roomNumber ? ` · ${activeRoom.roomNumber}` : ""}
            {` · Floor ${activeRoom.floor}`}
          </Typography>
          {activeRoom.occupants && activeRoom.occupants.length > 0 && (
            <Box sx={{ mt: 1.5 }}>
              {activeRoom.occupants.map((o, i) => (
                <Box key={i} sx={{ mb: 0.5 }}>
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
          )}
        </Box>
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
        <Tooltip title={t("toolbar.search")}>
          <IconButton size="small" onClick={() => togglePanel("search")} color={activePanel === "search" ? "primary" : "default"}>
            <SearchIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={t("toolbar.directions")}>
          <IconButton size="small" onClick={() => togglePanel("wayfind")} color={activePanel === "wayfind" ? "primary" : "default"}>
            <DirectionsIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        {tourStops.length > 0 && (
          <Tooltip title={t("toolbar.tour")}>
            <IconButton size="small" onClick={() => togglePanel("tour")} color={activePanel === "tour" ? "primary" : "default"}>
              <TourIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title={t("toolbar.layers")}>
          <IconButton size="small" onClick={() => togglePanel("layers")} color={activePanel === "layers" ? "primary" : "default"}>
            <LayersIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Language toggle — top-right on desktop, top-right on mobile too */}
      <Box
        sx={{
          position: "absolute",
          top: 16,
          right: 16,
          zIndex: 1401,
        }}
      >
        <LocaleToggle />
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
              {t("search.title")}
            </Typography>
            <IconButton size="small" onClick={() => setActivePanel(null)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
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
                  onClick={() => revealPoiAndEvent(poi)}
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
            {filteredPois.length === 0 && query && (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
                {t("search.noResults", { query })}
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
              {t("tour.title")}
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
