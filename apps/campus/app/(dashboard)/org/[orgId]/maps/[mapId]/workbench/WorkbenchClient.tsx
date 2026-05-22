"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast as toastify } from "react-toastify";
import {
  Button,
  KloradMark,
  Spinner,
  Workbench,
  WorkbenchTopBar,
  type WorkbenchToast,
} from "@klorad/design-system";
import { createSceneAPI } from "@klorad/api";
import type {
  CampusAPI,
  FloorPlan,
  POI,
  Room,
  TourStop,
} from "@klorad/api";
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
 * Owns:
 *   - The campus `CampusAPI` instance (created once per mount, lives in
 *     `apiRef` + the global `useCampusApiStore` so ops can reach it).
 *   - The fetched scene's metadata (display name, dirty state).
 *   - The bridge from `ctx.toast(...)` (operations) → react-toastify.
 *   - The persistent brand-level `WorkbenchTopBar` above the dock.
 *
 * The `DashboardShell` deliberately bypasses its top-bar / sidebar
 * chrome for `/workbench` routes — so this component gets the full
 * viewport and renders its own header.
 */
export default function WorkbenchClient({ mapId }: Props) {
  const [sceneReady, setSceneReady] = useState(false);
  const [mapName, setMapName] = useState<string | null>(null);
  const [pois, setPois] = useState<POI[]>([]);
  const [plans, setPlans] = useState<FloorPlan[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [tourStops] = useState<TourStop[]>([]);
  const apiRef = useRef<CampusAPI | null>(null);

  // Save state — the version counter ticks on every op mutation; the
  // top bar's Save button flips from "secondary, quiet" to "primary,
  // loud" once `version` outruns `lastSavedVersion`.
  const apiVersion = useCampusApiStore((s) => s.version);
  const setStoreApi = useCampusApiStore((s) => s.setApi);
  const [lastSavedVersion, setLastSavedVersion] = useState(0);
  const [saving, setSaving] = useState(false);
  const isDirty = apiVersion > lastSavedVersion;

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
        const sceneToLoad = withCampusLabelDefaults(data?.sceneData ?? {});
        api.load(sceneToLoad);
        setMapName(data?.name ?? null);
        setPois(api.poi.getAll());
        setPlans(api.floorPlans.getAll());
        setRooms(api.rooms.getAll());
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

  useEffect(() => {
    if (!sceneReady) return;
    if (!apiRef.current) return;
    if (apiVersion === 0) return;
    setPois(apiRef.current.poi.getAll());
    setPlans(apiRef.current.floorPlans.getAll());
    setRooms(apiRef.current.rooms.getAll());
  }, [apiVersion, sceneReady]);

  const entities = useMemo(
    () =>
      createCampusEntityIndex({
        worldId: mapId,
        pois,
        floorPlans: plans,
        rooms,
        tourStops,
      }),
    [mapId, pois, plans, rooms, tourStops],
  );

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

  // Top-bar Save handler. Calls the same export-then-PATCH flow the
  // `world.save` op uses, but stays on the React side so we can track
  // dirty state via the version counter. The op is still wired (palette
  // / WorldActions) for keyboard/mod+k surfacing.
  const handleSave = useCallback(async () => {
    const api = apiRef.current;
    if (!api) return;
    setSaving(true);
    try {
      const sceneData = api.export();
      const versionAtSave = apiVersion;
      const res = await fetch(`/api/maps/${mapId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneData }),
      });
      if (!res.ok) throw new Error("Save failed");
      setLastSavedVersion(versionAtSave);
      toastify.success("Map saved");
    } catch {
      toastify.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }, [mapId, apiVersion]);

  // World-level actions live in the top bar — they act on the whole
  // campus, not a selected element, so they belong with Save rather
  // than in the right panel. Both are still registered as operations
  // (`world.copy-link`, `world.open-viewer`) for ⌘K surfacing.
  const handleCopyLink = useCallback(() => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/campus/${mapId}`;
    navigator.clipboard
      ?.writeText(url)
      .then(() => toastify.success("Public link copied"))
      .catch(() => toastify.error("Couldn't copy the link"));
  }, [mapId]);

  const handleOpenViewer = useCallback(() => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/campus/${mapId}`;
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) toastify.warning("Pop-up blocked — couldn't open the viewer");
  }, [mapId]);

  // mod+s also saves — most-common keyboard expectation for editors.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() !== "s") return;
      e.preventDefault();
      void handleSave();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSave]);

  if (!sceneReady) {
    return <WorkbenchLoading />;
  }

  return (
    <div data-workbench className="flex h-screen w-screen flex-col bg-bg">
      <WorkbenchTopBar
        product="Campus"
        worldName={mapName ?? "Untitled campus"}
        worldSubtitle={
          isDirty ? "Unsaved changes" : sceneReady ? "Saved" : "Loading"
        }
        actor="You"
        actions={
          <>
            <Button size="sm" variant="secondary" onClick={handleOpenViewer}>
              Open viewer
            </Button>
            <Button size="sm" variant="secondary" onClick={handleCopyLink}>
              Share
            </Button>
            <Button
              size="sm"
              variant={isDirty ? "primary" : "secondary"}
              onClick={handleSave}
              disabled={saving || !isDirty}
            >
              {saving ? "Saving…" : isDirty ? "Save" : "Saved"}
            </Button>
          </>
        }
      />
      <div className="min-h-0 flex-1">
        <Workbench
          config={workbenchConfig}
          worldId={mapId}
          entities={entities}
          toast={toast}
        />
      </div>
    </div>
  );
}

/**
 * Branded loading state. Replaces the bare "Loading the scene…" line
 * that shipped earlier. Same chrome as the rest of the editor so the
 * first thing the user sees says "this is Klorad Campus" rather than
 * an unstyled placeholder.
 */
function WorkbenchLoading() {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-bg">
      <div className="flex items-center gap-3 text-text-secondary">
        <Spinner />
        <div className="flex items-center gap-2">
          <KloradMark className="h-5 w-5" />
          <span className="text-sm">
            Loading your campus…
          </span>
        </div>
      </div>
    </div>
  );
}
