"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import type { POI } from "@klorad/api";
import { useSceneStore } from "@klorad/core";
import type { Entity, View, ViewProps } from "@klorad/config/workbench";
import type { Map as MapboxMap } from "mapbox-gl";
import { useMapboxPoiLayer } from "@/app/hooks/useMapboxPoiLayer";
import { useMapboxDrawnBuildingsLayer } from "@/app/hooks/useMapboxDrawnBuildingsLayer";
import { useCampusLabelDefaults } from "@/app/hooks/useCampusLabelDefaults";
import { usePlacementStore } from "../placement-store";

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
  const selectedPoiId = ctx.selection.focusedId;

  useMapboxPoiLayer({
    pois,
    selectedPoiId,
    onPoiClick: (id) => {
      const next = selectedPoiId === id ? null : id;
      ctx.setSelection({
        ids: next ? new Set([next]) : new Set<string>(),
        focusedId: next,
      });
    },
  });

  // Render building extrusions for POIs that carry a `linkedBuilding`.
  // Plans + rooms are passed empty for v1 — full slab / room rendering
  // ships when the editing surface migrates over.
  useMapboxDrawnBuildingsLayer(pois, [], [], {
    selectedPoiId,
    activeFloor: null,
    onSelect: (id) => {
      ctx.setSelection({ ids: new Set([id]), focusedId: id });
    },
    clickEnabled: true,
  });

  // Force basemap labels off whenever the scene is mounted (Mapbox's
  // default street labels collide with campus content). The hook
  // internally early-returns until the map instance is registered in
  // the scene store, so passing `true` unconditionally is safe.
  useCampusLabelDefaults(true);

  // Placement listener — when an op activates a placement mode,
  // attach a one-shot map click that resolves the placement promise
  // with the clicked [lng, lat]. Esc cancels. The map's cursor flips
  // to crosshair while active for visual feedback.
  const placementMode = usePlacementStore((s) => s.active);
  useEffect(() => {
    if (!placementMode) return;
    const map = useSceneStore.getState().mapboxMap as MapboxMap | null;
    if (!map) return;

    const canvas = map.getCanvas();
    const prevCursor = canvas.style.cursor;
    canvas.style.cursor = "crosshair";

    const onClick = (e: { lngLat: { lng: number; lat: number } }) => {
      usePlacementStore.getState().complete([e.lngLat.lng, e.lngLat.lat]);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") usePlacementStore.getState().cancel();
    };
    map.once("click", onClick);
    document.addEventListener("keydown", onKey);

    return () => {
      canvas.style.cursor = prevCursor;
      map.off("click", onClick);
      document.removeEventListener("keydown", onKey);
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
 * Thin floating banner shown across the top of the map while a
 * placement is active. Calls `cancel()` on the Cancel button so the
 * op's awaiting promise resolves with null.
 */
function PlacementBanner({ mode }: { mode: string }) {
  const cancel = usePlacementStore((s) => s.cancel);
  const label =
    mode === "place-poi" ? "Click anywhere on the map to place the POI" : mode;
  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-line-soft bg-surface-1/95 px-4 py-2 text-xs text-text-primary shadow-glass backdrop-blur">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
        <span>{label}</span>
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
