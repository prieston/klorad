"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import type { FloorPlan, POI, Room } from "@klorad/api";
import { useSceneStore } from "@klorad/core";
import type { Entity, View, ViewProps } from "@klorad/config/workbench";
import { FloorSwitcher, SceneToolbar, type SceneTool } from "@klorad/design-system";
import type { Map as MapboxMap } from "mapbox-gl";
import { useMapboxPoiLayer } from "@/app/hooks/useMapboxPoiLayer";
import { useMapboxDrawnBuildingsLayer } from "@/app/hooks/useMapboxDrawnBuildingsLayer";
import { useMapboxFloorSlabsLayer } from "@/app/hooks/useMapboxFloorSlabsLayer";
import { useMapboxRoomsLayer } from "@/app/hooks/useMapboxRoomsLayer";
import { useMapboxWallsLayer } from "@/app/hooks/useMapboxWallsLayer";
import { useCampusLabelDefaults } from "@/app/hooks/useCampusLabelDefaults";
import { placementKind, usePlacementStore } from "../placement-store";
import { snapWallPoint } from "../wall-snapping";
import { useFloorDesignStore } from "../floor-design-store";

const MapboxViewer = dynamic(
  () =>
    import("@klorad/engine-mapbox").then((m) => ({ default: m.MapboxViewer })),
  { ssr: false, loading: () => <MapLoadingFallback /> },
);

function MapLoadingFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-bg text-sm text-text-tertiary">
      Loading 3D scene…
    </div>
  );
}

/**
 * Phase 3b — the real Map view.
 *
 * Reads POIs from `ctx.entities`, mounts the campus Mapbox layer
 * hooks for rendering (POI markers + drawn-building extrusions +
 * basemap-label defaults), bridges 3D clicks to `ctx.setSelection`.
 *
 * Phase 5d-d — also listens to the placement store. When an op like
 * `poi.place` activates a placement, the MapView attaches a one-shot
 * map click handler and reports the captured `[lng, lat]` back; Esc
 * cancels. A thin banner across the top of the canvas tells the user
 * what's happening.
 */
function MapViewComponent({ ctx }: ViewProps) {
  const pois = (ctx.entities.byType("campus.poi") as Entity<POI>[]).map(
    (e) => e.payload,
  );
  const allFloorPlans = (
    ctx.entities.byType("campus.floor-plan") as Entity<FloorPlan>[]
  ).map((e) => e.payload);
  const allRooms = (ctx.entities.byType("campus.room") as Entity<Room>[]).map(
    (e) => e.payload,
  );
  const selectedId = ctx.selection.focusedId;
  const placementMode = usePlacementStore((s) => s.active);
  const designPlanId = useFloorDesignStore((s) => s.designPlanId);

  // Resolve the focused selection into the things the indoor layers
  // care about — which building POI is in focus, and which floor (if
  // a floor plan is selected). Phase 1 — drives the X-ray reveal.
  const { selectedBuildingId, activeFloor } = useMemo(() => {
    if (!selectedId) {
      return { selectedBuildingId: null, activeFloor: null as number | null };
    }
    // Selected entity is a POI with a linkedBuilding payload → it's the
    // building itself.
    const poi = pois.find((p) => p.id === selectedId);
    if (poi?.linkedBuilding) {
      return { selectedBuildingId: selectedId, activeFloor: null };
    }
    // Selected entity is a floor plan → infer the building + active floor.
    const plan = allFloorPlans.find((p) => p.id === selectedId);
    if (plan) {
      return {
        selectedBuildingId: plan.buildingId ?? null,
        activeFloor: plan.floor ?? null,
      };
    }
    // Selected entity is a room → infer the building + active floor.
    const room = allRooms.find((r) => r.id === selectedId);
    if (room) {
      return {
        selectedBuildingId: room.buildingId,
        activeFloor: room.floor,
      };
    }
    return { selectedBuildingId: null, activeFloor: null as number | null };
  }, [selectedId, pois, allFloorPlans, allRooms]);

  // Rooms visible at any time = only the selected building's rooms.
  // Phase 1 caps it here for performance; once we have a sample campus
  // with hundreds of rooms the trade-off is worth revisiting (a
  // viewport-based filter, or LOD culling).
  const roomsForSelection = useMemo<Room[]>(() => {
    if (!selectedBuildingId) return [];
    return allRooms.filter((r) => r.buildingId === selectedBuildingId);
  }, [allRooms, selectedBuildingId]);

  // Floor list for the FloorSwitcher overlay — every floor for which
  // the building has a plan, ordered top-down (highest first) to
  // match the visual stacking of the building.
  const plansForBuilding = useMemo<FloorPlan[]>(() => {
    if (!selectedBuildingId) return [];
    return allFloorPlans.filter((p) => p.buildingId === selectedBuildingId);
  }, [allFloorPlans, selectedBuildingId]);
  const buildingFloors = useMemo<number[]>(() => {
    const floors = plansForBuilding
      .map((p) => p.floor)
      .filter((f): f is number => typeof f === "number");
    return Array.from(new Set(floors)).sort((a, b) => b - a);
  }, [plansForBuilding]);

  // Translate a floor pick into a selection of the matching floor
  // plan entity — that keeps the workbench's single-source-of-truth
  // model (everything is a selection) and means the rest of the
  // wiring above ("if focused entity is a plan, derive activeFloor")
  // works unchanged.
  const onFloorChange = (floor: number | null) => {
    if (floor === null) {
      if (selectedBuildingId) {
        ctx.setSelection({
          ids: new Set([selectedBuildingId]),
          focusedId: selectedBuildingId,
        });
      } else {
        ctx.setSelection({ ids: new Set<string>(), focusedId: null });
      }
      return;
    }
    const plan = plansForBuilding.find((p) => p.floor === floor);
    if (plan) {
      ctx.setSelection({ ids: new Set([plan.id]), focusedId: plan.id });
    }
  };

  useMapboxPoiLayer({
    pois,
    selectedPoiId: selectedId,
    onPoiClick: (id) => {
      // While a placement (e.g. wall drawing) is active, map clicks
      // belong to the placement — don't also change the selection.
      if (usePlacementStore.getState().active) return;
      const next = selectedId === id ? null : id;
      ctx.setSelection({
        ids: next ? new Set([next]) : new Set<string>(),
        focusedId: next,
      });
    },
  });

  // Building shells — when a building is selected and an `activeFloor`
  // is in focus, the shell renders an X-ray cap that lets the eye see
  // the rooms inside. Plans + rooms are now real (Phase 1) rather than
  // the empty stubs the workbench shipped with on day one.
  useMapboxDrawnBuildingsLayer(pois, allFloorPlans, allRooms, {
    // The X-ray reveal keys off the *building* — pass the resolved
    // building id so it engages even when a floor plan or room is the
    // focused entity (then `selectedId` is the plan/room, not the
    // building).
    selectedPoiId: selectedBuildingId,
    activeFloor,
    onSelect: (id) => {
      if (usePlacementStore.getState().active) return;
      ctx.setSelection({ ids: new Set([id]), focusedId: id });
    },
    // Suppress building clicks while a placement is in progress.
    clickEnabled: !placementMode && !designPlanId,
    // Floor-plan design mode hides every shell.
    hidden: !!designPlanId,
  });

  // Floor slabs — the horizontal plates between floors. Clicking one
  // selects the matching floor plan, which becomes the new focused
  // entity and drives `activeFloor` above.
  useMapboxFloorSlabsLayer(pois, designPlanId ? [] : allFloorPlans, allRooms, {
    activePlanId: activeFloor != null ? selectedId : null,
    selectedBuildingPoiId: selectedBuildingId,
    onSelect: (_buildingId, _floor, planId) => {
      if (usePlacementStore.getState().active) return;
      if (planId) ctx.setSelection({ ids: new Set([planId]), focusedId: planId });
    },
  });

  // Rooms — the 3D extruded volumes inside the building, rendered with
  // the X-ray-friendly opacity. Scoped to the selected building so we
  // don't paint every room in every building all at once.
  useMapboxRoomsLayer(designPlanId ? [] : roomsForSelection, {
    activeFloor,
    onSelect: (id) => {
      if (usePlacementStore.getState().active) return;
      ctx.setSelection({ ids: new Set([id]), focusedId: id });
    },
    highlightRoomId:
      selectedId && allRooms.some((r) => r.id === selectedId)
        ? selectedId
        : null,
  });

  // Walls of the active floor — rendered as 3D extrusions whenever a
  // floor is in view (its plan, or a room on it, is selected), not
  // only while the Draw-wall tool is active.
  const activeFloorPlan =
    activeFloor != null
      ? (plansForBuilding.find((p) => p.floor === activeFloor) ?? null)
      : null;
  useMapboxWallsLayer(
    activeFloorPlan?.walls ?? [],
    activeFloorPlan?.floor ?? 0,
    !!designPlanId,
  );

  // Force basemap labels off whenever the scene is mounted (Mapbox's
  // default street labels collide with campus content). The hook
  // internally early-returns until the map instance is registered in
  // the scene store, so passing `true` unconditionally is safe.
  useCampusLabelDefaults(true);

  // Placement listener — when an op activates a placement mode, route
  // map clicks to the placement store. Point modes capture a single
  // click and resolve; polygon modes accumulate vertices and close on
  // double-click / Enter. Esc always cancels. Canvas cursor flips to
  // crosshair while active for visual feedback.

  // Scene tools — drawing actions performed directly on the canvas.
  // "Draw building" is always available; "Define room" needs a floor
  // plan in focus so the new room knows which building + level it
  // belongs to. They invoke the same placement operations the ⌘K
  // palette does, just from a always-visible floating bar.
  const sceneTools = useMemo<SceneTool[]>(() => {
    const focusedPlanId =
      allFloorPlans.find((p) => p.id === selectedId)?.id ?? null;
    return [
      {
        id: "building.draw",
        label: "Draw building",
        icon: DrawBuildingIcon,
        active: placementMode === "draw-building",
        onSelect: () => void ctx.runOperation("building.draw", undefined, []),
      },
      {
        id: "room.define",
        label: "Define room",
        icon: DefineRoomIcon,
        active: placementMode === "draw-room",
        disabled: !focusedPlanId,
        hint: "Select a floor first",
        onSelect: () => {
          if (focusedPlanId) {
            void ctx.runOperation("room.define", undefined, [focusedPlanId]);
          }
        },
      },
      {
        id: "wall.draw",
        label: "Draw wall",
        icon: DrawWallIcon,
        active: placementMode === "draw-wall",
        disabled: !focusedPlanId,
        hint: "Select a floor first",
        onSelect: () => {
          if (focusedPlanId) {
            void ctx.runOperation("wall.draw", undefined, [focusedPlanId]);
          }
        },
      },
      {
        id: "floor.design",
        label: designPlanId ? "Done" : "Design floor",
        icon: DesignFloorIcon,
        active: !!designPlanId,
        disabled: !designPlanId && !focusedPlanId,
        hint: "Select a floor first",
        onSelect: () => {
          if (designPlanId) {
            useFloorDesignStore.getState().exit();
          } else if (focusedPlanId) {
            useFloorDesignStore.getState().enter(focusedPlanId);
          }
        },
      },
    ];
  }, [allFloorPlans, selectedId, placementMode, designPlanId, ctx]);

  useEffect(() => {
    if (!placementMode) return;
    const map = useSceneStore.getState().mapboxMap as MapboxMap | null;
    if (!map) return;

    const canvas = map.getCanvas();
    const prevCursor = canvas.style.cursor;
    canvas.style.cursor = "crosshair";

    const kind = placementKind(placementMode);
    type MapClick = { lngLat: { lng: number; lat: number } };

    const cleanups: Array<() => void> = [];

    if (kind === "point") {
      const onClick = (e: MapClick) => {
        usePlacementStore
          .getState()
          .completePoint([e.lngLat.lng, e.lngLat.lat]);
      };
      map.once("click", onClick);
      cleanups.push(() => map.off("click", onClick));
    } else {
      // Polygon / polyline: each click adds a vertex, double-click
      // closes. Wall mode (`line`) snaps each click (endpoint /
      // ortho). The zoom-on-double-click default would interfere, so
      // suppress it for the duration.
      const prevDblClickZoom = map.doubleClickZoom?.isEnabled();
      map.doubleClickZoom?.disable();
      const isLine = kind === "line";
      const closeShape = () => {
        const store = usePlacementStore.getState();
        if (isLine) store.closeLine();
        else store.closePolygon();
      };

      const onClick = (e: MapClick) => {
        const store = usePlacementStore.getState();
        let coords: [number, number] = [e.lngLat.lng, e.lngLat.lat];
        if (isLine) {
          coords = snapWallPoint(coords, map, store.pendingPoints).point;
        }
        store.addPoint(coords);
      };
      const onDblClick = () => {
        // Mapbox fires `click` THEN `dblclick`. The dblclick already
        // appended one extra vertex via the click handler — drop it
        // before closing.
        const store = usePlacementStore.getState();
        if (store.pendingPoints.length > 0) {
          store.pendingPoints.pop();
        }
        closeShape();
      };
      map.on("click", onClick);
      map.on("dblclick", onDblClick);
      cleanups.push(() => {
        map.off("click", onClick);
        map.off("dblclick", onDblClick);
        if (prevDblClickZoom) map.doubleClickZoom?.enable();
      });
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") usePlacementStore.getState().cancel();
      if (e.key === "Enter" && kind !== "point") {
        const store = usePlacementStore.getState();
        if (kind === "line") store.closeLine();
        else store.closePolygon();
      }
    };
    document.addEventListener("keydown", onKey);
    cleanups.push(() => document.removeEventListener("keydown", onKey));

    return () => {
      canvas.style.cursor = prevCursor;
      for (const fn of cleanups) fn();
    };
  }, [placementMode]);

  // The scene is full-bleed behind the dock panels. Scene-anchored
  // controls portal into the dock's centre slot so they track the
  // panels instead of hiding beneath them; if the slot isn't mounted
  // yet they fall back to rendering in place.
  const [overlayHost, setOverlayHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setOverlayHost(document.querySelector<HTMLElement>("[data-dock-center]"));
  }, []);

  const sceneControls = (
    <>
      <SceneToolbar
        tools={sceneTools}
        className="pointer-events-auto absolute left-4 top-4"
      />
      {placementMode ? <PlacementBanner mode={placementMode} /> : null}
      {buildingFloors.length > 0 ? (
        <FloorSwitcher
          floors={buildingFloors}
          activeFloor={activeFloor}
          onChange={onFloorChange}
          className="pointer-events-auto absolute right-4 top-1/2 -translate-y-1/2"
        />
      ) : null}
    </>
  );

  // `relative` is load-bearing: MapboxViewer's container is
  // `position: absolute; inset: 0`, so it needs a positioned ancestor
  // to fill rather than escape to the viewport.
  return (
    <div className="relative h-full w-full">
      <MapboxViewer />
      {overlayHost ? createPortal(sceneControls, overlayHost) : sceneControls}
    </div>
  );
}

/**
 * Floating banner shown across the top of the map while a placement
 * is active. Adapts copy + actions to the placement kind:
 *   - point modes: instruct, offer Cancel
 *   - polygon modes: show vertex count, offer Done + Cancel
 */
function PlacementBanner({ mode }: { mode: string }) {
  const cancel = usePlacementStore((s) => s.cancel);
  const closePolygon = usePlacementStore((s) => s.closePolygon);
  const pendingCount = usePlacementStore((s) => s.pendingPoints.length);
  const isPolygon = mode === "draw-building" || mode === "draw-room";
  const label = isPolygon
    ? `Click to add vertices · ${pendingCount} placed · double-click or Enter to finish`
    : mode === "place-poi"
      ? "Click anywhere on the map to place the POI"
      : mode;
  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-line-soft bg-surface-1/95 px-4 py-2 text-xs text-text-primary shadow-glass backdrop-blur">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
        <span>{label}</span>
        {isPolygon ? (
          <button
            type="button"
            onClick={closePolygon}
            disabled={pendingCount < 3}
            className="ml-1 rounded font-medium text-accent transition-colors hover:text-accent-hover disabled:text-text-tertiary"
          >
            Done
          </button>
        ) : null}
        <button
          type="button"
          onClick={cancel}
          className="ml-1 rounded text-text-secondary transition-colors hover:text-text-primary"
        >
          Cancel (Esc)
        </button>
      </div>
    </div>
  );
}

function DesignFloorIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="1" />
      <path d="M3 10 L14 10 L14 21 M14 10 L14 3" />
    </svg>
  );
}

function DrawWallIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M3 20 L9 4 L15 20 L21 8" />
    </svg>
  );
}

function DrawBuildingIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M3 21h18" />
      <path d="M6 21V8l7-4 7 4v13" />
      <path d="M10 21v-5h6v5" />
      <path d="M10 12h.01M14 12h.01" />
    </svg>
  );
}

function DefineRoomIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="1.5" />
      <path d="M3 14h7v7" />
      <circle cx="14" cy="9" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

function MapIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <polygon points="1 6 8 3 16 6 23 3 23 18 16 21 8 18 1 21 1 6" />
      <line x1="8" y1="3" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="21" />
    </svg>
  );
}

export const mapView: View = {
  id: "map",
  label: "Map",
  icon: MapIcon,
  entityTypes: "*",
  defaultDock: "center",
  component: MapViewComponent,
};
