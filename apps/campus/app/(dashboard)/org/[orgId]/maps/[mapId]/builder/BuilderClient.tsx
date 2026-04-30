"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  Box,
  Button,
  Checkbox,
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
  Tooltip,
  Typography,
} from "@mui/material";
import CheckBoxIcon from "@mui/icons-material/CheckBoxOutlined";
import AddIcon from "@mui/icons-material/Add";
import { v4 as uuidv4 } from "uuid";
import { alpha } from "@mui/material/styles";
import {
  LocationSearch,
  RightDrawer,
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
  UndoIcon,
  RedoIcon,
} from "@klorad/ui";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import DomainAddIcon from "@mui/icons-material/DomainAdd";
import { captureMapboxScreenshot } from "@/app/utils/captureMapboxScreenshot";
import type { SceneTool } from "@klorad/ui";
import { toast } from "react-toastify";
import { createSceneAPI } from "@klorad/api";
import type { CampusAPI, POI, POICategory } from "@klorad/api";
import { useSceneStore } from "@klorad/core";
import type { Map as MapboxMap, MapMouseEvent } from "mapbox-gl";
import BuilderLeftPanel from "./BuilderLeftPanel";
import BuildingsView from "./BuildingsView";
import FloorPlanDrawer, { buildCornerBounds } from "./FloorPlanDrawer";
import type { FloorPlan as KloradFloorPlan } from "@klorad/api";
import { useMapboxPoiLayer } from "@/app/hooks/useMapboxPoiLayer";
import { useMapboxPoiDrag } from "@/app/hooks/useMapboxPoiDrag";
import { useMapboxFloorPlanLayer } from "@/app/hooks/useMapboxFloorPlanLayer";
import { useMapboxRoomsLayer } from "@/app/hooks/useMapboxRoomsLayer";
import { useMapboxDrawnBuildingsLayer } from "@/app/hooks/useMapboxDrawnBuildingsLayer";
import { useMapboxFloorSlabsLayer } from "@/app/hooks/useMapboxFloorSlabsLayer";
import { usePolygonDraw } from "@/app/hooks/usePolygonDraw";
import {
  useCampusLabelDefaults,
  withCampusLabelDefaults,
} from "@/app/hooks/useCampusLabelDefaults";
import { useUndoRedo } from "@/app/hooks/useUndoRedo";
import { ROOM_TEMPLATES, getRoomTemplate } from "@/app/lib/roomTemplates";
import type { Room } from "@klorad/api";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [placingPoi, setPlacingPoi] = useState(false);
  const [activeTool, setActiveTool] = useState<
    "select" | "linkBuilding" | "edit" | "drawRoom" | "drawBuilding"
  >("select");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [pendingPolygon, setPendingPolygon] = useState<[number, number][] | null>(null);
  // When the user starts a room draw from the Buildings tree we know
  // the exact floor — otherwise (toolbar click) we fall back to
  // `activePlan?.floor ?? 0`. Cleared after each commit.
  const [pendingRoomFloor, setPendingRoomFloor] = useState<number | null>(null);
  const [roomForm, setRoomForm] = useState<{
    name: string;
    roomNumber: string;
    type: string;
    occupantName: string;
    occupantRole: string;
  }>({ name: "", roomNumber: "", type: "office", occupantName: "", occupantRole: "" });
  const [activeView, setActiveView] = useState<"poi" | "location" | "buildings">("poi");
  const [sceneReady, setSceneReady] = useState(false);
  const apiRef = useRef<CampusAPI | null>(null);
  const mapboxScene = useSceneStore((s) => s.mapboxSceneData);
  const selectedMapboxBuilding = useSceneStore((s) => s.selectedMapboxBuilding);
  const setSelectedMapboxBuilding = useSceneStore((s) => s.setSelectedMapboxBuilding);

  useMapboxPoiLayer({
    pois,
    selectedPoiId,
    onPoiClick: (id) => {
      if (multiSelectMode) {
        toggleMultiSelect(id);
        return;
      }
      setSelectedPoiId((prev) => (prev === id ? null : id));
    },
  });

  const { pushSnapshot, undo, redo, canUndo, canRedo } = useUndoRedo(apiRef, () => {
    if (!apiRef.current) return;
    setPois(apiRef.current.poi.getAll());
    setSelectedPoiId(null);
    setSelectedIds(new Set());
  });

  useMapboxPoiDrag({
    enabled: activeTool === "edit",
    onPoiMoved: (id, lng, lat) => {
      if (!apiRef.current) return;
      pushSnapshot();
      apiRef.current.poi.update(id, { position: [lng, lat, 0] });
      setPois(apiRef.current.poi.getAll());
    },
  });

  const [activePlanId, setActivePlanId] = useState<string | null>(null);
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
    pushSnapshot();
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
    pushSnapshot();
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
    if (!activePlanId) return null;
    return floorPlansForSelection.find((p) => p.id === activePlanId) ?? null;
  }, [activePlanId, floorPlansForSelection]);

  useMapboxFloorPlanLayer(activePlan);
  useCampusLabelDefaults(sceneReady);

  // Reset active plan when POI selection changes
  useEffect(() => {
    setActivePlanId(null);
  }, [selectedPoiId]);

  // Rooms for the selected building — keep in sync with the scene store
  const roomsForSelection = useMemo(() => {
    if (!selectedPoiId) return [] as Room[];
    return rooms.filter((r) => r.buildingId === selectedPoiId);
  }, [rooms, selectedPoiId]);

  // Map-layer clicks should be muted while the user is actively
  // tracing a polygon — otherwise the first vertex tap is intercepted
  // by whatever's under the cursor and the polygon never starts.
  const isDrawing = activeTool === "drawRoom" || activeTool === "drawBuilding";

  useMapboxRoomsLayer(roomsForSelection, {
    activeFloor: activePlan?.floor ?? null,
    onSelect: (id) => {
      setActiveRoomId(id);
      setActiveView("buildings");
    },
    highlightRoomId: activeRoomId,
    clickEnabled: !isDrawing,
  });

  // Render every drawn building as stacked 3D shells. Per-spec:
  //   - idle (no active floor): full block per building, neutral grey.
  //   - floor selected: clip to floors <= activeFloor in the selected
  //     building; the active floor's walls fade to x-ray; below floors
  //     stay visible as the structure.
  // The hook also takes plans + rooms so it can derive the floor count
  // for the building's height.
  const allPlans = apiRef.current?.floorPlans.getAll() ?? [];
  // The "active floor" for clipping comes from whichever drove the most
  // recent intent — explicit pendingRoomFloor (Buildings tree → Draw)
  // wins over the active plan's floor, which wins over null (idle).
  const activeFloorForClip =
    pendingRoomFloor ?? activePlan?.floor ?? null;
  useMapboxDrawnBuildingsLayer(pois, allPlans, rooms, {
    selectedPoiId,
    activeFloor: activeFloorForClip,
    onSelect: (id) => {
      setSelectedPoiId(id);
      apiRef.current?.poi.flyTo(id);
    },
    clickEnabled: !isDrawing,
  });

  // Floor slabs — thin discs at each floor's elevation. Only render
  // when a floor is active so the idle "block" view stays clean.
  useMapboxFloorSlabsLayer(pois, allPlans, rooms, {
    activePlanId,
    selectedBuildingPoiId: selectedPoiId,
    onSelect: (buildingPoiId, floor, planId) => {
      setSelectedPoiId(buildingPoiId);
      setActivePlanId(planId);
      setPendingRoomFloor(floor);
    },
    clickEnabled: !isDrawing,
  });

  // Building polygon awaiting commit, plus its draft form.
  const [pendingBuildingPolygon, setPendingBuildingPolygon] = useState<
    [number, number][] | null
  >(null);
  const [buildingForm, setBuildingForm] = useState<{
    name: string;
    description: string;
    heightM: number;
  }>({ name: "", description: "", heightM: 12 });

  // Single polygon-draw session — `activeTool` discriminates between
  // drawRoom and drawBuilding, and we route the finished ring to the
  // right pending-state.
  usePolygonDraw({
    active: activeTool === "drawRoom" || activeTool === "drawBuilding",
    onFinish: (poly) => {
      if (activeTool === "drawRoom") {
        setPendingPolygon(poly);
        setRoomForm((f) => ({
          ...f,
          name: "",
          roomNumber: "",
          type: f.type || "office",
        }));
      } else if (activeTool === "drawBuilding") {
        setPendingBuildingPolygon(poly);
        setBuildingForm({ name: "", description: "", heightM: 12 });
      }
      setActiveTool("select");
    },
    onCancel: () => setActiveTool("select"),
  });

  const commitNewRoom = () => {
    if (!pendingPolygon || !apiRef.current || !selectedPoiId) return;
    pushSnapshot();
    const added = apiRef.current.rooms.add({
      name: roomForm.name.trim() || "Unnamed room",
      roomNumber: roomForm.roomNumber.trim() || undefined,
      type: (roomForm.type as Room["type"]) || "office",
      buildingId: selectedPoiId,
      floor: pendingRoomFloor ?? activePlan?.floor ?? 0,
      polygon: pendingPolygon,
      occupants: roomForm.occupantName.trim()
        ? [{ name: roomForm.occupantName.trim(), role: roomForm.occupantRole.trim() || undefined }]
        : undefined,
    });
    setRooms(apiRef.current.rooms.getAll());
    setActiveRoomId(added.id);
    setPendingPolygon(null);
    setPendingRoomFloor(null);
    setRoomForm({ name: "", roomNumber: "", type: "office", occupantName: "", occupantRole: "" });
    toast.success("Room added");
    void persistMap();
  };

  const cancelNewRoom = () => {
    setPendingPolygon(null);
    setPendingRoomFloor(null);
    setRoomForm({ name: "", roomNumber: "", type: "office", occupantName: "", occupantRole: "" });
  };

  // --- Floor plan management (in the Buildings tab) ---
  const [floorDrawerOpen, setFloorDrawerOpen] = useState(false);
  const [floorDrawerBuildingId, setFloorDrawerBuildingId] = useState<string | null>(null);
  const [editingFloorPlan, setEditingFloorPlan] = useState<KloradFloorPlan | null>(null);

  const persistMap = async () => {
    const sceneData = apiRef.current?.export();
    if (!sceneData) return;
    try {
      await fetch(`/api/maps/${mapId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneData }),
      });
    } catch {
      /* the user can hit Save explicitly */
    }
  };

  /**
   * One-click "+ Add floor" — figures out the next floor number from
   * existing plans + rooms, creates an empty FloorPlan placeholder
   * (no image), sets it as the active plan, and flies the camera up
   * to that floor's elevation so the user can immediately draw rooms.
   */
  const quickAddFloor = (buildingPoiId: string) => {
    if (!apiRef.current) return;
    const buildingPlans = apiRef.current.floorPlans.forBuilding(buildingPoiId);
    const buildingRooms = apiRef.current.rooms.forBuilding(buildingPoiId);
    const usedFloors = new Set<number>();
    buildingPlans.forEach((p) => usedFloors.add(p.floor ?? 0));
    buildingRooms.forEach((r) => usedFloors.add(r.floor));
    const nextFloor =
      usedFloors.size === 0 ? 0 : Math.max(...Array.from(usedFloors)) + 1;
    pushSnapshot();
    const created = apiRef.current.floorPlans.add({
      name: `Floor ${nextFloor}`,
      buildingId: buildingPoiId,
      floor: nextFloor,
      // No url / coordinates — empty floor placeholder.
    });
    setSelectedPoiId(buildingPoiId);
    setActivePlanId(created.id);
    setPendingRoomFloor(nextFloor);

    // Fly the camera to the new floor's elevation so the user can see
    // the slab they just added. Mapbox doesn't take an explicit camera
    // altitude, so we lean into pitch + zoom to make the new height
    // visible from a 3/4 view.
    const poi = pois.find((p) => p.id === buildingPoiId);
    const lng = poi?.linkedBuilding?.lng ?? poi?.position[0];
    const lat = poi?.linkedBuilding?.lat ?? poi?.position[1];
    if (typeof lng === "number" && typeof lat === "number") {
      const map = useSceneStore.getState().mapboxMap as MapboxMap | null;
      map?.flyTo({
        center: [lng, lat],
        zoom: Math.max(18, map?.getZoom?.() ?? 18),
        pitch: 65,
        // Slight bearing tweak per floor so the user feels orbital motion
        // when adding multiple floors — purely aesthetic.
        bearing: ((nextFloor * 12) % 360) - 60,
        duration: 900,
        essential: true,
      });
    }
    toast.success(`Floor ${nextFloor} added · draw rooms or add a plan image`);
    void persistMap();
  };

  const openEditFloor = (planId: string) => {
    if (!apiRef.current) return;
    const plan = apiRef.current.floorPlans.getAll().find((p) => p.id === planId);
    if (!plan) return;
    setEditingFloorPlan(plan);
    setFloorDrawerBuildingId(plan.buildingId ?? null);
    setFloorDrawerOpen(true);
  };

  const handleSaveFloorPlan = async (form: {
    id: string;
    name: string;
    url: string;
    buildingPoiId: string;
    floor: number;
    widthMeters: number;
    heightMeters: number;
  }) => {
    if (!apiRef.current) return;
    const building = pois.find((p) => p.id === form.buildingPoiId);
    const lng = building?.linkedBuilding?.lng ?? building?.position[0];
    const lat = building?.linkedBuilding?.lat ?? building?.position[1];
    if (typeof lng !== "number" || typeof lat !== "number") {
      toast.error("Pick a linked building.");
      return;
    }
    pushSnapshot();
    // Only attach coordinates when there's actually an image to overlay.
    // A floor without a plan image is still a valid floor — rooms can
    // be drawn on it directly.
    const coords = form.url
      ? buildCornerBounds(lng, lat, form.widthMeters, form.heightMeters)
      : undefined;
    if (form.id) {
      apiRef.current.floorPlans.update(form.id, {
        name: form.name || `Floor ${form.floor}`,
        url: form.url || undefined,
        buildingId: form.buildingPoiId,
        floor: form.floor,
        coordinates: coords,
      });
      toast.success(form.url ? "Floor plan updated" : "Floor updated");
    } else {
      apiRef.current.floorPlans.add({
        name: form.name || `Floor ${form.floor}`,
        url: form.url || undefined,
        buildingId: form.buildingPoiId,
        floor: form.floor,
        coordinates: coords,
      });
      toast.success(form.url ? "Floor plan added" : "Floor added");
    }
    await persistMap();
  };

  const handleRemoveFloorPlan = async (planId: string) => {
    if (!apiRef.current) return;
    pushSnapshot();
    apiRef.current.floorPlans.remove(planId);
    if (activePlanId === planId) setActivePlanId(null);
    toast.success("Floor plan removed");
    await persistMap();
  };

  /**
   * Compute the centroid of a polygon ring. Used to anchor the
   * created POI marker (and its `linkedBuilding.lng/lat`).
   */
  const polygonCentroid = (
    ring: [number, number][]
  ): [number, number] => {
    if (ring.length === 0) return [0, 0];
    let sumLng = 0;
    let sumLat = 0;
    for (const [lng, lat] of ring) {
      sumLng += lng;
      sumLat += lat;
    }
    return [sumLng / ring.length, sumLat / ring.length];
  };

  const commitNewBuilding = () => {
    if (!pendingBuildingPolygon || !apiRef.current) return;
    const name = buildingForm.name.trim() || "Untitled building";
    const heightM = Math.max(2, Math.round(buildingForm.heightM || 12));
    const [lng, lat] = polygonCentroid(pendingBuildingPolygon);
    pushSnapshot();
    const newPoi = apiRef.current.poi.add({
      name,
      description: buildingForm.description.trim() || undefined,
      position: [lng, lat, 0],
      category: "building",
      linkedBuilding: {
        lng,
        lat,
        polygon: pendingBuildingPolygon,
        heightM,
        label: name,
      },
    });
    setPois(apiRef.current.poi.getAll());
    setSelectedPoiId(newPoi.id);
    setPendingBuildingPolygon(null);
    setBuildingForm({ name: "", description: "", heightM: 12 });
    toast.success("Building created");
    void persistMap();
  };

  const cancelNewBuilding = () => {
    setPendingBuildingPolygon(null);
    setBuildingForm({ name: "", description: "", heightM: 12 });
  };

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
        // Always run the scene through `withCampusLabelDefaults` so a
        // brand-new map (no saved sceneData) still gets labels off.
        const sceneToLoad = withCampusLabelDefaults(data?.sceneData ?? {});
        api.load(sceneToLoad);
        setPois(api.poi.getAll());
        setRooms(api.rooms.getAll());
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

    pushSnapshot();
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
      pushSnapshot();
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
    pushSnapshot();
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
    pushSnapshot();
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
    pushSnapshot();
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
    pushSnapshot();
    apiRef.current.poi.update(selectedPoiId, { view: undefined });
    setPois(apiRef.current.poi.getAll());
  };

  const handleDeletePoi = (id: string) => {
    if (!apiRef.current) return;
    pushSnapshot();
    apiRef.current.poi.remove(id);
    setPois(apiRef.current.poi.getAll());
    if (selectedPoiId === id) setSelectedPoiId(null);
    setSelectedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // Multi-select
  const toggleMultiSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearMultiSelect = () => setSelectedIds(new Set());

  const selectAllVisiblePois = () => {
    setSelectedIds(new Set(pois.map((p) => p.id)));
  };

  const handleBulkDelete = () => {
    if (!apiRef.current || selectedIds.size === 0) return;
    pushSnapshot();
    for (const id of selectedIds) apiRef.current.poi.remove(id);
    const n = selectedIds.size;
    setSelectedIds(new Set());
    if (selectedPoiId && selectedIds.has(selectedPoiId)) setSelectedPoiId(null);
    setPois(apiRef.current.poi.getAll());
    toast.success(`${n} POI${n === 1 ? "" : "s"} deleted`);
  };

  // Delete key removes the multi-selection (ignore when typing in a field)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      if (selectedIds.size === 0) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      e.preventDefault();
      handleBulkDelete();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds]);

  const handleUpdatePoi = (field: keyof POI, value: unknown) => {
    if (!apiRef.current || !selectedPoiId) return;
    pushSnapshot();
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
    {
      id: "drawBuilding",
      icon: <DomainAddIcon fontSize="small" />,
      label: "Draw building (3D)",
      active: activeTool === "drawBuilding",
      onClick: () => {
        setActiveTool((prev) =>
          prev === "drawBuilding" ? "select" : "drawBuilding"
        );
      },
    },
    {
      id: "drawRoom",
      icon: <MeetingRoomIcon fontSize="small" />,
      label: selectedPoiId
        ? `Draw room on floor ${activePlan?.floor ?? 0}`
        : "Draw room (select a building POI first)",
      active: activeTool === "drawRoom",
      onClick: () => {
        if (!selectedPoiId) {
          toast.info("Select a building POI first, then draw the room.");
          return;
        }
        setActiveTool((prev) => (prev === "drawRoom" ? "select" : "drawRoom"));
      },
    },
    {
      id: "undo",
      icon: <UndoIcon fontSize="small" />,
      label: "Undo",
      active: false,
      disabled: !canUndo,
      onClick: undo,
    },
    {
      id: "redo",
      icon: <RedoIcon fontSize="small" />,
      label: "Redo",
      active: false,
      disabled: !canRedo,
      onClick: redo,
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
    pushSnapshot();
    apiRef.current?.setLocation(lng, lat, { zoom: 17 });
    toast.success("Map location updated — save to persist");
  };

  // --- Thumbnail capture ---
  const [thumbDrawerOpen, setThumbDrawerOpen] = useState(false);
  const [thumbDataUrl, setThumbDataUrl] = useState<string | null>(null);
  const [thumbCapturing, setThumbCapturing] = useState(false);
  const [thumbSaving, setThumbSaving] = useState(false);

  const handleCaptureThumbnail = async () => {
    const map = useSceneStore.getState().mapboxMap as MapboxMap | null;
    if (!map) {
      toast.error("Map not ready");
      return;
    }
    setThumbCapturing(true);
    setThumbDataUrl(null);
    setThumbDrawerOpen(true);
    try {
      const dataUrl = await captureMapboxScreenshot(map);
      if (!dataUrl) throw new Error("No image captured");
      setThumbDataUrl(dataUrl);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to capture screenshot");
      setThumbDrawerOpen(false);
    } finally {
      setThumbCapturing(false);
    }
  };

  const handleSaveThumbnail = async () => {
    if (!thumbDataUrl) return;
    setThumbSaving(true);
    try {
      const res = await fetch(`/api/maps/${mapId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thumbnail: thumbDataUrl }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast.success("Thumbnail saved");
      setThumbDrawerOpen(false);
      setThumbDataUrl(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save thumbnail");
    } finally {
      setThumbSaving(false);
    }
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

        {/* Floating LevelSwitcher is intentionally hidden in the Studio —
            the Buildings tab tree is the canonical floor picker now. The
            public viewer keeps the floating pill since end-users don't
            have access to the studio panel. */}

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
              icon={<ApartmentIcon />}
              label="Buildings"
              active={activeView === "buildings"}
              onClick={() => {
                setActiveView("buildings");
                if (placingPoi) setPlacingPoi(false);
              }}
            />
            <ActionButton
              icon={<AddLocationAltIcon />}
              label="POIs"
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

          {activeView === "buildings" && (
            <Box sx={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <BuildingsView
                pois={pois}
                plans={apiRef.current?.floorPlans.getAll() ?? []}
                rooms={rooms}
                selectedPoiId={selectedPoiId}
                activePlanId={activePlanId}
                activeRoomId={activeRoomId}
                onSelectBuilding={(id) => {
                  setSelectedPoiId(id);
                  if (id) apiRef.current?.poi.flyTo(id);
                  else {
                    setActivePlanId(null);
                    setPendingRoomFloor(null);
                  }
                }}
                onSelectFloor={(poiId, planId) => {
                  setSelectedPoiId(poiId);
                  setActivePlanId(planId);
                  if (planId === null) setPendingRoomFloor(null);
                }}
                onSelectRoom={(roomId) => setActiveRoomId(roomId)}
                onDrawBuilding={() => setActiveTool("drawBuilding")}
                onAddFloor={quickAddFloor}
                onDrawRoom={(buildingPoiId, floor, planId) => {
                  setSelectedPoiId(buildingPoiId);
                  setActivePlanId(planId);
                  setPendingRoomFloor(floor);
                  setActiveTool("drawRoom");
                }}
                onEditFloor={openEditFloor}
                onRemoveFloor={(planId) => void handleRemoveFloorPlan(planId)}
                onUpdateRoom={(roomId, patch) => {
                  if (!apiRef.current) return;
                  pushSnapshot();
                  apiRef.current.rooms.update(roomId, patch);
                  setRooms(apiRef.current.rooms.getAll());
                  void persistMap();
                }}
                onRemoveRoom={(roomId) => {
                  if (!apiRef.current) return;
                  pushSnapshot();
                  apiRef.current.rooms.remove(roomId);
                  setRooms(apiRef.current.rooms.getAll());
                  if (activeRoomId === roomId) setActiveRoomId(null);
                  void persistMap();
                }}
              />
            </Box>
          )}

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
                Card Thumbnail
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ fontSize: "0.8125rem" }}
              >
                Capture the current map view as the preview image shown on the
                campus card in the dashboard and Campuses list.
              </Typography>
              <Button
                variant="outlined"
                startIcon={<PhotoCameraIcon sx={{ fontSize: 16 }} />}
                onClick={handleCaptureThumbnail}
                sx={{ textTransform: "none", alignSelf: "flex-start" }}
              >
                Generate from current view
              </Button>
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
                {pois.length > 0 && (
                  <Tooltip title={multiSelectMode ? "Exit select mode" : "Select POIs"}>
                    <IconButton
                      size="small"
                      onClick={() => {
                        if (multiSelectMode) {
                          setMultiSelectMode(false);
                          clearMultiSelect();
                        } else {
                          setMultiSelectMode(true);
                          setSelectedPoiId(null);
                        }
                      }}
                      sx={(th) => ({
                        p: 0.5,
                        color: multiSelectMode ? "primary.main" : "text.secondary",
                        bgcolor: multiSelectMode ? alpha(th.palette.primary.main, 0.12) : "transparent",
                      })}
                    >
                      <CheckBoxIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                )}
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
            {/* Bulk-action bar — visible only in multi-select mode with active selection */}
            {multiSelectMode && selectedIds.size > 0 && (
              <Box
                sx={(t) => ({
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  mb: 1,
                  px: 1,
                  py: 0.5,
                  borderRadius: 1,
                  bgcolor: alpha(t.palette.primary.main, 0.14),
                  border: "1px solid",
                  borderColor: alpha(t.palette.primary.main, 0.3),
                })}
              >
                <Typography
                  variant="caption"
                  color="primary.main"
                  sx={{ flex: 1, fontWeight: 700, fontSize: "0.75rem" }}
                >
                  {selectedIds.size} selected
                </Typography>
                <Button
                  size="small"
                  color="inherit"
                  onClick={clearMultiSelect}
                  sx={{ fontSize: "0.7rem", textTransform: "none", py: 0, opacity: 0.7 }}
                >
                  Clear
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  color="error"
                  onClick={handleBulkDelete}
                  startIcon={<DeleteOutlineIcon sx={{ fontSize: 14 }} />}
                  sx={{ fontSize: "0.7rem", textTransform: "none", py: 0.25 }}
                >
                  Delete
                </Button>
              </Box>
            )}

            {/* Select-all row — only in multi-select mode with POIs */}
            {multiSelectMode && pois.length > 0 && (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  pl: 0.75,
                  pr: 1,
                  py: 0.25,
                  mb: 0.5,
                  opacity: 0.75,
                }}
              >
                <Checkbox
                  size="small"
                  indeterminate={selectedIds.size > 0 && selectedIds.size < pois.length}
                  checked={selectedIds.size === pois.length}
                  onChange={(e) => (e.target.checked ? selectAllVisiblePois() : clearMultiSelect())}
                  sx={{ p: 0.5 }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem", ml: 0.5 }}>
                  Select all
                </Typography>
              </Box>
            )}

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
            {pois.map((poi) => {
              const isMultiSelected = selectedIds.has(poi.id);
              const isSingleSelected = poi.id === selectedPoiId;
              return (
              <ListItemButton
                key={poi.id}
                selected={!multiSelectMode && isSingleSelected}
                onClick={() => {
                  if (multiSelectMode) {
                    toggleMultiSelect(poi.id);
                  } else if (isSingleSelected) {
                    // Second click on the already-selected POI closes its
                    // detail view.
                    setSelectedPoiId(null);
                  } else {
                    handleSelectPoi(poi.id);
                  }
                }}
                sx={(t) => ({
                  borderRadius: 1,
                  mb: 0.25,
                  pl: 0.5,
                  pr: 0.5,
                  "&:hover": { bgcolor: alpha(t.palette.primary.main, 0.08) },
                  "&.Mui-selected": {
                    bgcolor: alpha(t.palette.primary.main, 0.12),
                    "&:hover": { bgcolor: alpha(t.palette.primary.main, 0.16) },
                  },
                  ...(multiSelectMode && isMultiSelected && {
                    outline: "1px solid",
                    outlineColor: "primary.main",
                  }),
                })}
              >
                {multiSelectMode && (
                  <Checkbox
                    size="small"
                    checked={isMultiSelected}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggleMultiSelect(poi.id)}
                    sx={{ p: 0.25, mr: 0.5 }}
                  />
                )}
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
              );
            })}
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

      {/* Floor plan add / edit drawer */}
      <FloorPlanDrawer
        open={floorDrawerOpen}
        editingPlan={editingFloorPlan}
        defaultBuildingPoiId={floorDrawerBuildingId}
        linkedPois={pois.filter((p) => p.linkedBuilding)}
        onClose={() => {
          setFloorDrawerOpen(false);
          setEditingFloorPlan(null);
          setFloorDrawerBuildingId(null);
        }}
        onSave={handleSaveFloorPlan}
        onDelete={handleRemoveFloorPlan}
      />

      {/* Thumbnail preview drawer */}
      <RightDrawer
        open={thumbDrawerOpen}
        onClose={() => {
          if (thumbSaving) return;
          setThumbDrawerOpen(false);
          setThumbDataUrl(null);
        }}
        title="Card thumbnail preview"
        actions={
          <>
            <Button
              variant="outlined"
              onClick={handleCaptureThumbnail}
              disabled={thumbCapturing || thumbSaving}
              fullWidth
              sx={{ textTransform: "none" }}
            >
              Retake
            </Button>
            <Button
              variant="contained"
              onClick={handleSaveThumbnail}
              disabled={!thumbDataUrl || thumbSaving}
              fullWidth
              sx={{ textTransform: "none" }}
            >
              {thumbSaving ? <CircularProgress size={16} /> : "Use as thumbnail"}
            </Button>
          </>
        }
      >
        <Typography variant="body2" color="text.secondary">
          This is how the campus card will look on the dashboard and Campuses
          list. Pan and zoom the map behind, then hit Retake to refresh.
        </Typography>
        <Box
          sx={(theme) => ({
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 1,
            overflow: "hidden",
            bgcolor: "action.hover",
            aspectRatio: "16 / 10",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          })}
        >
          {thumbCapturing ? (
            <CircularProgress size={24} />
          ) : thumbDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbDataUrl}
              alt="Thumbnail preview"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <Typography variant="caption" color="text.secondary">
              No preview
            </Typography>
          )}
        </Box>
      </RightDrawer>

      {/* Create-building drawer — opens after the user finishes the
          polygon trace. Captures name + extrusion height + description
          and creates a POI with `linkedBuilding.polygon`. */}
      <RightDrawer
        open={Boolean(pendingBuildingPolygon)}
        onClose={cancelNewBuilding}
        title="Create building"
        actions={
          <>
            <Button
              variant="outlined"
              onClick={cancelNewBuilding}
              fullWidth
              sx={{ textTransform: "none" }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={commitNewBuilding}
              disabled={!buildingForm.name.trim()}
              fullWidth
              sx={{ textTransform: "none" }}
            >
              Create building
            </Button>
          </>
        }
      >
        <FormField label="Building name" gutterBottom>
          <TextField
            autoFocus
            fullWidth
            size="small"
            placeholder="e.g. Library — Block C"
            value={buildingForm.name}
            onChange={(e) =>
              setBuildingForm((f) => ({ ...f, name: e.target.value }))
            }
          />
        </FormField>
        <FormField label="Description (optional)" gutterBottom>
          <TextField
            fullWidth
            size="small"
            multiline
            minRows={2}
            placeholder="Short description shown on the public viewer card"
            value={buildingForm.description}
            onChange={(e) =>
              setBuildingForm((f) => ({ ...f, description: e.target.value }))
            }
          />
        </FormField>
        <FormField
          label="Height (m)"
          helperText="How tall the 3D extrusion should be. ~3 m per floor is a good default."
        >
          <TextField
            type="number"
            fullWidth
            size="small"
            value={buildingForm.heightM}
            onChange={(e) =>
              setBuildingForm((f) => ({
                ...f,
                heightM: parseInt(e.target.value, 10) || 12,
              }))
            }
            slotProps={{ htmlInput: { min: 2, step: 1 } }}
          />
        </FormField>
        <Typography variant="caption" color="text.secondary">
          A POI marker is created at the centre of the building so you can
          attach floor plans, rooms, and metadata to it from the Buildings
          tab. Save the map to persist.
        </Typography>
      </RightDrawer>

      {/* New-room drawer — opens after the user finishes the polygon
          trace. Editing existing rooms is now inline in the Buildings
          tab's RoomDetail view. */}
      <RightDrawer
        open={Boolean(pendingPolygon)}
        onClose={cancelNewRoom}
        title="Create room"
        actions={
          <>
            <Button
              variant="outlined"
              onClick={cancelNewRoom}
              fullWidth
              sx={{ textTransform: "none" }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={commitNewRoom}
              disabled={!roomForm.name.trim()}
              fullWidth
              sx={{ textTransform: "none" }}
            >
              Create room
            </Button>
          </>
        }
      >
        <FormField label="Room name" gutterBottom>
          <TextField
            autoFocus
            fullWidth
            size="small"
            placeholder="e.g. Office 204"
            value={roomForm.name}
            onChange={(e) => setRoomForm((f) => ({ ...f, name: e.target.value }))}
          />
        </FormField>
        <FormField label="Room number (optional)" gutterBottom>
          <TextField
            fullWidth
            size="small"
            placeholder="e.g. B3-204"
            value={roomForm.roomNumber}
            onChange={(e) => setRoomForm((f) => ({ ...f, roomNumber: e.target.value }))}
          />
        </FormField>
        <FormField label="Room type" gutterBottom>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 1 }}>
            {ROOM_TEMPLATES.map((tpl) => {
              const active = roomForm.type === tpl.id;
              return (
                <Box
                  key={tpl.id}
                  role="button"
                  onClick={() => setRoomForm((f) => ({ ...f, type: tpl.id }))}
                  sx={(t) => ({
                    cursor: "pointer",
                    p: 1,
                    borderRadius: 1,
                    border: `1px solid ${active ? tpl.color : t.palette.divider}`,
                    bgcolor: active ? `${tpl.color}22` : "transparent",
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    transition: "all 0.15s ease",
                  })}
                >
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      bgcolor: tpl.color,
                      flexShrink: 0,
                    }}
                  />
                  <Typography variant="caption" sx={{ fontSize: "0.75rem", fontWeight: active ? 600 : 400 }}>
                    {tpl.label}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </FormField>
        <Typography variant="caption" color="text.secondary">
          Default height: {getRoomTemplate(roomForm.type).heightM}m
        </Typography>
        <Divider sx={{ my: 1 }} />
        <FormField label="Occupant (optional)" gutterBottom>
          <TextField
            fullWidth
            size="small"
            placeholder="Prof. Papadopoulos"
            value={roomForm.occupantName}
            onChange={(e) => setRoomForm((f) => ({ ...f, occupantName: e.target.value }))}
          />
        </FormField>
        <FormField label="Role (optional)" gutterBottom>
          <TextField
            fullWidth
            size="small"
            placeholder="Associate Professor"
            value={roomForm.occupantRole}
            onChange={(e) => setRoomForm((f) => ({ ...f, occupantRole: e.target.value }))}
          />
        </FormField>
      </RightDrawer>
    </Box>
  );
}
