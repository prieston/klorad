"use client";

import dynamic from "next/dynamic";
import type { POI } from "@klorad/api";
import type { Entity, View, ViewProps } from "@klorad/config/workbench";
import { useMapboxPoiLayer } from "@/app/hooks/useMapboxPoiLayer";
import { useMapboxDrawnBuildingsLayer } from "@/app/hooks/useMapboxDrawnBuildingsLayer";
import { useCampusLabelDefaults } from "@/app/hooks/useCampusLabelDefaults";

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
 * Read-only for v1. The full editing surface (drawing tools, room
 * panels, undo/redo, the floor-plan drawer) stays on `/builder`
 * until Phase 5 — by which time the engine setup can be unified via
 * a `useCampusScene` hook (see WORKBENCH-PHASE-3.md §4).
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

  return (
    <div className="h-full w-full">
      <MapboxViewer />
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
