"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Spinner } from "@klorad/design-system";
import type { MapData, MapView, Space } from "@mappedin/mappedin-js";
import type { MappedinVenue } from "./config";
import { WayfindingControls, type SpaceOption } from "./WayfindingControls";
import { SearchControls } from "./SearchControls";
import { FloorControls, type FloorOption } from "./FloorControls";

/**
 * The MappedIn indoor viewer.
 *
 * Renders a 3D indoor venue via the MappedIn Web SDK, with every
 * space labelled, a search box that flies the camera to a room,
 * directions between two spaces, and exploration controls to switch
 * floors and buildings. This file is the *single* place the SDK is
 * imported — the swap-out seam for the future in-house engine.
 *
 * The SDK is dynamically imported inside the effect so it never
 * touches the server bundle and stays out of the main chunk. The
 * `import type` above is erased at build, so it costs nothing.
 */
export function MappedinViewer({ venue }: { venue: MappedinVenue }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapViewRef = useRef<MapView | null>(null);
  const mapDataRef = useRef<MapData | null>(null);
  // Named spaces by id — the route handlers need the real Space
  // objects, while the picker UI only needs `{ id, name }`.
  const spacesRef = useRef<Map<string, Space>>(new Map());
  // The space last highlighted by search, with its pre-highlight
  // colour — `updateState` has no "reset", so reverting means
  // re-applying the colour the space had before it was highlighted.
  const highlightRef = useRef<{
    space: Space;
    originalColor: string | undefined;
  } | null>(null);

  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);
  const [spaces, setSpaces] = useState<SpaceOption[]>([]);
  const [routing, setRouting] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [floors, setFloors] = useState<FloorOption[]>([]);
  const [currentFloorId, setCurrentFloorId] = useState("");
  const [buildings, setBuildings] = useState<FloorOption[]>([]);
  const [currentBuildingId, setCurrentBuildingId] = useState("");
  const [selectedSpace, setSelectedSpace] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Highlight a space (accent fill), reverting any previous one — the
  // shared mechanism behind both search and click selection.
  const highlightSpace = useCallback((space: Space) => {
    const mapView = mapViewRef.current;
    if (!mapView) return;
    const previous = highlightRef.current;
    if (previous && previous.space === space) return;
    if (previous) {
      try {
        mapView.updateState(previous.space, {
          color: previous.originalColor,
        });
      } catch {
        /* ignore */
      }
    }
    let originalColor: string | undefined;
    try {
      originalColor = mapView.getState(space)?.color;
    } catch {
      /* ignore */
    }
    highlightRef.current = { space, originalColor };
    try {
      mapView.updateState(space, { color: "#158ca3" });
    } catch {
      /* ignore */
    }
  }, []);

  // Drop the selection — clear the detail card and the highlight.
  const clearSelection = useCallback(() => {
    setSelectedSpace(null);
    const mapView = mapViewRef.current;
    const previous = highlightRef.current;
    if (mapView && previous) {
      try {
        mapView.updateState(previous.space, {
          color: previous.originalColor,
        });
      } catch {
        /* ignore */
      }
    }
    highlightRef.current = null;
  }, []);

  // Re-read the floor list + active floor/building from the SDK so
  // the exploration controls reflect the venue's true state after a
  // floor or building switch.
  const syncFloors = useCallback(() => {
    const mapView = mapViewRef.current;
    const mapData = mapDataRef.current;
    if (!mapView || !mapData) return;
    const stack = mapView.currentFloorStack;
    const floorList = stack?.floors ?? mapData.getByType("floor");
    setFloors(
      [...floorList]
        .sort((a, b) => b.elevation - a.elevation)
        .map((f) => ({ id: f.id, name: f.name ?? "Floor" })),
    );
    setCurrentFloorId(mapView.currentFloor?.id ?? "");
    setCurrentBuildingId(stack?.id ?? "");
  }, []);

  useEffect(() => {
    let cancelled = false;
    let view: MapView | null = null;

    void (async () => {
      const el = containerRef.current;
      if (!el) return;
      setStatus("loading");
      setError(null);
      try {
        const { getMapData, show3dMap } = await import(
          "@mappedin/mappedin-js"
        );
        const mapData = await getMapData({
          key: venue.key,
          secret: venue.secret,
          mapId: venue.mapId,
        });
        if (cancelled) return;
        view = await show3dMap(el, mapData);
        if (cancelled) {
          (view as { destroy?: () => void }).destroy?.();
          return;
        }
        mapViewRef.current = view;
        mapDataRef.current = mapData;

        // Tap a space → identify it (highlight + detail card); tap
        // empty space → clear the selection.
        view.on("click", (event) => {
          const clicked = event.spaces?.find((s) => s.name);
          if (clicked) {
            highlightSpace(clicked);
            setSelectedSpace({
              id: clicked.id,
              name: clicked.name as string,
            });
          } else {
            clearSelection();
          }
        });

        // Collect named spaces for the directions pickers.
        const byId = new Map<string, Space>();
        for (const space of mapData.getByType("space")) {
          if (space.name) byId.set(space.id, space);
        }
        spacesRef.current = byId;
        // Label every named space — the venue renders as unlabelled
        // geometry otherwise.
        for (const space of byId.values()) {
          try {
            view.Labels.add(space, space.name as string);
          } catch {
            /* skip a label that won't anchor */
          }
        }
        setSpaces(
          [...byId.values()]
            .map((s) => ({ id: s.id, name: s.name as string }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
        // Buildings (floor-stacks) for the exploration controls.
        setBuildings(
          mapData
            .getByType("floor-stack")
            .map((s) => ({ id: s.id, name: s.name ?? "Building" })),
        );
        syncFloors();
        setStatus("ready");
      } catch (e) {
        if (cancelled) return;
        setError(
          e instanceof Error ? e.message : "Failed to load the indoor map",
        );
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      (view as { destroy?: () => void } | null)?.destroy?.();
      mapViewRef.current = null;
      mapDataRef.current = null;
    };
  }, [
    venue.key,
    venue.secret,
    venue.mapId,
    syncFloors,
    highlightSpace,
    clearSelection,
  ]);

  const handleRoute = useCallback(async (fromId: string, toId: string) => {
    const mapData = mapDataRef.current;
    const mapView = mapViewRef.current;
    if (!mapData || !mapView) return;
    const from = spacesRef.current.get(fromId);
    const to = spacesRef.current.get(toId);
    if (!from || !to) return;

    setRouting(true);
    setRouteError(null);
    try {
      mapView.Navigation.clear();
      const directions = await mapData.getDirections(from, to);
      if (!directions) {
        setRouteError("No route between those spaces.");
        return;
      }
      await mapView.Navigation.draw(directions);
    } catch (e) {
      setRouteError(e instanceof Error ? e.message : "Routing failed");
    } finally {
      setRouting(false);
    }
  }, []);

  const handleClear = useCallback(() => {
    mapViewRef.current?.Navigation.clear();
    setRouteError(null);
  }, []);

  // Search → switch to the space's floor, highlight + select it, fly there.
  const handleSearchSelect = useCallback(
    async (spaceId: string) => {
      const mapView = mapViewRef.current;
      const space = spacesRef.current.get(spaceId);
      if (!mapView || !space) return;
      try {
        if (space.floor) {
          await mapView.setFloor(space.floor);
          syncFloors();
        }
        highlightSpace(space);
        setSelectedSpace({ id: space.id, name: space.name as string });
        await mapView.Camera.focusOn(space);
      } catch {
        /* best-effort — a failed focus shouldn't surface an error */
      }
    },
    [highlightSpace, syncFloors],
  );

  const handleSelectFloor = useCallback(
    async (floorId: string) => {
      const mapView = mapViewRef.current;
      if (!mapView) return;
      try {
        await mapView.setFloor(floorId);
      } catch {
        /* ignore */
      }
      syncFloors();
    },
    [syncFloors],
  );

  const handleSelectBuilding = useCallback(
    async (buildingId: string) => {
      const mapView = mapViewRef.current;
      if (!mapView) return;
      try {
        await mapView.setFloorStack(buildingId);
      } catch {
        /* ignore */
      }
      syncFloors();
    },
    [syncFloors],
  );

  return (
    <div className="relative h-full w-full bg-bg">
      <div ref={containerRef} className="h-full w-full" />

      {status === "loading" ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex items-center gap-3 text-sm text-text-secondary">
            <Spinner />
            Loading indoor map…
          </span>
        </div>
      ) : null}

      {status === "error" ? (
        <div className="absolute inset-0 flex items-center justify-center p-8">
          <div className="max-w-sm rounded-2xl border border-line-soft bg-surface-1 p-5 text-center shadow-glass">
            <p className="text-sm font-medium text-text-primary">
              Indoor map unavailable
            </p>
            <p className="mt-1 text-xs text-text-tertiary">{error}</p>
          </div>
        </div>
      ) : null}

      {status === "ready" && spaces.length > 0 ? (
        <div className="absolute left-4 top-4 z-10 flex w-72 flex-col gap-3">
          <SearchControls
            spaces={spaces}
            onSelect={(id) => void handleSearchSelect(id)}
          />
          {spaces.length >= 2 ? (
            <WayfindingControls
              spaces={spaces}
              routing={routing}
              error={routeError}
              onRoute={(from, to) => void handleRoute(from, to)}
              onClear={handleClear}
            />
          ) : null}
        </div>
      ) : null}

      {status === "ready" ? (
        <FloorControls
          floors={floors}
          currentFloorId={currentFloorId}
          buildings={buildings}
          currentBuildingId={currentBuildingId}
          onSelectFloor={(id) => void handleSelectFloor(id)}
          onSelectBuilding={(id) => void handleSelectBuilding(id)}
          // Top-right — clear of MappedIn's own zoom / nav controls,
          // which sit centred on the right edge.
          className="absolute right-4 top-4 z-10"
        />
      ) : null}

      {selectedSpace ? (
        <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-line-soft bg-surface-1/95 px-4 py-2.5 shadow-glass backdrop-blur">
          <span className="text-sm font-medium text-text-primary">
            {selectedSpace.name}
          </span>
          <button
            type="button"
            onClick={clearSelection}
            aria-label="Clear selection"
            className="text-sm leading-none text-text-tertiary transition-colors hover:text-text-primary"
          >
            ✕
          </button>
        </div>
      ) : null}
    </div>
  );
}
