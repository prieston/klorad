"use client";

import { useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import type { FloorPlan, POI, Room } from "@klorad/api";
import { useSceneStore } from "@klorad/core";
import type { Entity, View, ViewProps } from "@klorad/config/workbench";
import type { Map as MapboxMap } from "mapbox-gl";
import { useMapboxPoiLayer } from "@/app/hooks/useMapboxPoiLayer";
import { useMapboxDrawnBuildingsLayer } from "@/app/hooks/useMapboxDrawnBuildingsLayer";
import { useMapboxFloorSlabsLayer } from "@/app/hooks/useMapboxFloorSlabsLayer";
import { useMapboxRoomsLayer } from "@/app/hooks/useMapboxRoomsLayer";
import { useCampusLabelDefaults } from "@/app/hooks/useCampusLabelDefaults";
import { placementKind, usePlacementStore } from "../placement-store";

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

  useMapboxPoiLayer({
    pois,
    selectedPoiId: selectedId,
    onPoiClick: (id) => {
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
    selectedPoiId: selectedId,
    activeFloor,
    onSelect: (id) => {
      ctx.setSelection({ ids: new Set([id]), focusedId: id });
    },
    clickEnabled: true,
  });

  // Floor slabs — the horizontal plates between floors. Clicking one
  // selects the matching floor plan, which becomes the new focused
  // entity and drives `activeFloor` above.
  useMapboxFloorSlabsLayer(pois, allFloorPlans, allRooms, {
    activePlanId: activeFloor != null ? selectedId : null,
    selectedBuildingPoiId: selectedBuildingId,
    onSelect: (_buildingId, _floor, planId) => {
      if (planId) ctx.setSelection({ ids: new Set([planId]), focusedId: planId });
    },
  });

  // Rooms — the 3D extruded volumes inside the building, rendered with
  // the X-ray-friendly opacity. Scoped to the selected building so we
  // don't paint every room in every building all at once.
  useMapboxRoomsLayer(roomsForSelection, {
    activeFloor,
    onSelect: (id) => {
      ctx.setSelection({ ids: new Set([id]), focusedId: id });
    },
    highlightRoomId:
      selectedId && allRooms.some((r) => r.id === selectedId)
        ? selectedId
        : null,
  });

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
  const placementMode = usePlacementStore((s) => s.active);
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
      // Polygon: each click adds a vertex; double-click closes; the
      // existing zoom-on-double-click default would interfere, so we
      // suppress it for the duration.
      const prevDblClickZoom = map.doubleClickZoom?.isEnabled();
      map.doubleClickZoom?.disable();

      const onClick = (e: MapClick) => {
        usePlacementStore
          .getState()
          .addPoint([e.lngLat.lng, e.lngLat.lat]);
      };
      const onDblClick = (e: MapClick) => {
        // Mapbox fires `click` THEN `dblclick`. The dblclick already
        // appended one extra vertex via the click handler — drop it
        // before closing.
        const store = usePlacementStore.getState();
        if (store.pendingPoints.length > 0) {
          store.pendingPoints.pop();
        }
        store.closePolygon();
        // Mark the event handled so the underlying mapbox dblclick
        // doesn't fall through to anything else.
        e satisfies MapClick;
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
      if (e.key === "Enter" && kind === "polygon") {
        usePlacementStore.getState().closePolygon();
      }
    };
    document.addEventListener("keydown", onKey);
    cleanups.push(() => document.removeEventListener("keydown", onKey));

    return () => {
      canvas.style.cursor = prevCursor;
      for (const fn of cleanups) fn();
    };
  }, [placementMode]);

  // `relative` is load-bearing: MapboxViewer's container is
  // `position: absolute; inset: 0`, so without a positioned ancestor
  // it escapes the dock's flex layout and renders against the viewport
  // — painting over the left and right dock columns. `/builder` wraps
  // the viewer in `<Box position="relative">` for the same reason.
  return (
    <div className="relative h-full w-full">
      <MapboxViewer />
      {placementMode ? <PlacementBanner mode={placementMode} /> : null}
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
