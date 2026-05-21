"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast as toastify } from "react-toastify";
import { Workbench, type WorkbenchToast } from "@klorad/design-system";
import { createSceneAPI } from "@klorad/api";
import type { CampusAPI, FloorPlan, POI, TourStop } from "@klorad/api";
import { withCampusLabelDefaults } from "@/app/hooks/useCampusLabelDefaults";
import workbenchConfig from "@/workbench.config";
import { createCampusEntityIndex } from "@/lib/workbench";
import { useCampusApiStore } from "@/lib/workbench/campus-api-store";

interface Props {
  mapId: string;
}

/**
 * Mounts the shared Workbench shell with the campus config.
 *
 * Phase 3b: this component owns its own `CampusAPI` instance and load
 * (mirroring `BuilderClient`'s setup) and feeds the resulting POIs and
 * floor plans through `createCampusEntityIndex` to the shell. The
 * `MapView` view consumes those entities and mounts the Mapbox layer
 * hooks for rendering — same engine code path as `/builder`, but
 * with the editing surface deferred to Phase 5.
 *
 * Both routes call into the same layer hooks against the same scene
 * store; engine init runs once per route until a shared
 * `useCampusScene` hook unifies it (WORKBENCH-PHASE-3.md §4).
 *
 * The `DashboardShell` deliberately bypasses its top-bar / sidebar
 * chrome for `/workbench` routes — same as `/builder` — so the shell
 * gets the full viewport.
 */
export default function WorkbenchClient({ mapId }: Props) {
  const [sceneReady, setSceneReady] = useState(false);
  const [pois, setPois] = useState<POI[]>([]);
  const [plans, setPlans] = useState<FloorPlan[]>([]);
  const [tourStops] = useState<TourStop[]>([]);
  const apiRef = useRef<CampusAPI | null>(null);

  // Phase 5d-a — ops mutate the CampusAPI and call `bump()` to
  // invalidate. We subscribe to the version counter and re-pull
  // entity lists when it ticks. This is the "live entity index"
  // glue: views see fresh data after every op without each op
  // needing to know about React state.
  const apiVersion = useCampusApiStore((s) => s.version);
  const setStoreApi = useCampusApiStore((s) => s.setApi);

  useEffect(() => {
    const api = createSceneAPI("mapbox", "campus") as CampusAPI;
    apiRef.current = api;
    setStoreApi(api);

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/maps/${mapId}`);
        if (!res.ok) throw new Error("Failed to load map");
        const data = await res.json();
        if (cancelled) return;
        // Same default-labels-off pass the builder applies, so a
        // brand-new map still loads with clean basemap labels.
        const sceneToLoad = withCampusLabelDefaults(data?.sceneData ?? {});
        api.load(sceneToLoad);
        setPois(api.poi.getAll());
        setPlans(api.floorPlans.getAll());
      } catch {
        // New or unreachable map — fall through to empty defaults.
      } finally {
        if (!cancelled) setSceneReady(true);
      }
    })();

    return () => {
      cancelled = true;
      setStoreApi(null);
    };
  }, [mapId, setStoreApi]);

  // Re-pull entity lists whenever an op bumps the version. The first
  // load (above) populates pois/plans on success; this effect handles
  // every subsequent mutation. Guarded by `sceneReady` so the initial
  // load doesn't fight with this hook.
  useEffect(() => {
    if (!sceneReady) return;
    if (!apiRef.current) return;
    if (apiVersion === 0) return;
    setPois(apiRef.current.poi.getAll());
    setPlans(apiRef.current.floorPlans.getAll());
  }, [apiVersion, sceneReady]);

  const entities = useMemo(
    () =>
      createCampusEntityIndex({
        worldId: mapId,
        pois,
        floorPlans: plans,
        tourStops,
      }),
    [mapId, pois, plans, tourStops],
  );

  // Bridge the Workbench's `ctx.toast(msg, tone)` calls — emitted from
  // inside operation `invoke` bodies — to react-toastify, the same
  // surface BuilderClient / SettingsTab already use elsewhere in
  // campus. The ToastContainer is mounted at the app's providers level.
  const toast = useCallback<WorkbenchToast>((msg, tone) => {
    switch (tone) {
      case "success":
        toastify.success(msg);
        return;
      case "warning":
        toastify.warning(msg);
        return;
      case "error":
        toastify.error(msg);
        return;
      default:
        toastify.info(msg);
    }
  }, []);

  if (!sceneReady) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-bg text-sm text-text-secondary">
        Loading the scene…
      </div>
    );
  }

  return (
    <div className="h-screen w-screen">
      <Workbench
        config={workbenchConfig}
        worldId={mapId}
        entities={entities}
        toast={toast}
      />
    </div>
  );
}
