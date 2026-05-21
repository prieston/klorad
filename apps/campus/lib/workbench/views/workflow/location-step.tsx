"use client";

import { useState } from "react";
import { useSceneStore } from "@klorad/core";
import { Button, cn } from "@klorad/design-system";
import type { Map as MapboxMap } from "mapbox-gl";
import { useCampusApiStore } from "../../campus-api-store";

/**
 * Workflow step 1 — define the campus's initial camera pose.
 *
 * Reads the current Mapbox view (center + zoom) and lets the user
 * stamp it as the campus's saved location via `api.setLocation(...)`.
 * The pose is replayed every time the world loads.
 *
 * Vertical-specific (campus only — uses the CampusAPI singleton and
 * the campus's scene store). Mounted by `workflow/index.tsx`.
 */
export function LocationStep() {
  const [savedView, setSavedView] = useState<{
    lng: number;
    lat: number;
    zoom: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const captureCurrent = () => {
    const map = useSceneStore.getState().mapboxMap as MapboxMap | null;
    if (!map) return;
    const center = map.getCenter();
    const zoom = map.getZoom();
    const api = useCampusApiStore.getState().api;
    if (!api) return;

    setSaving(true);
    try {
      api.setLocation?.(center.lng, center.lat, { zoom });
      setSavedView({ lng: center.lng, lat: center.lat, zoom });
      useCampusApiStore.getState().bump();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-line-soft p-4">
        <div className="text-[0.65rem] font-medium uppercase tracking-[0.14em] text-text-tertiary">
          Current map view
        </div>
        <LiveCoords className="mt-2" />
      </div>

      <Button
        size="sm"
        onClick={captureCurrent}
        disabled={saving}
        className="w-full justify-center"
      >
        {saving ? "Saving…" : "Use current view as campus location"}
      </Button>

      {savedView ? (
        <div className="rounded-2xl border border-line-soft p-4">
          <div className="text-[0.65rem] font-medium uppercase tracking-[0.14em] text-text-tertiary">
            Saved
          </div>
          <div className="mt-2 font-mono text-[0.75rem] tabular-nums text-text-primary">
            {savedView.lng.toFixed(5)}°, {savedView.lat.toFixed(5)}°
          </div>
          <div className="mt-0.5 font-mono text-[0.65rem] tabular-nums text-text-tertiary">
            zoom {savedView.zoom.toFixed(2)}
          </div>
        </div>
      ) : null}

      <p className="text-[0.7rem] leading-relaxed text-text-tertiary">
        Pan and zoom the map to where you want visitors to start, then
        press the button above. The view is stored with the campus and
        replayed on every load.
      </p>
    </div>
  );
}

/** Reads the live map center + zoom on every render. */
function LiveCoords({ className }: { className?: string }) {
  const map = useSceneStore((s) => s.mapboxMap) as MapboxMap | null;
  if (!map) {
    return (
      <p className={cn("text-xs text-text-tertiary", className)}>
        Waiting for the map…
      </p>
    );
  }
  const c = map.getCenter();
  const z = map.getZoom();
  return (
    <div className={className}>
      <div className="font-mono text-[0.75rem] tabular-nums text-text-primary">
        {c.lng.toFixed(5)}°, {c.lat.toFixed(5)}°
      </div>
      <div className="mt-0.5 font-mono text-[0.65rem] tabular-nums text-text-tertiary">
        zoom {z.toFixed(2)}
      </div>
    </div>
  );
}
