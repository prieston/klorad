"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import type { MapData, MapView, Space } from "@mappedin/mappedin-js";
import type { MappedinVenue } from "./config";
import { translate, type Locale } from "@/app/lib/i18n-core";
import { type SpaceOption } from "./WayfindingControls";
import { type FloorOption } from "./FloorControls";
import { SidePanel } from "./SidePanel";
import { WelcomeOverlay } from "./WelcomeOverlay";

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
/**
 * Imperative handle exposed via `ref` — the parent can take a
 * screenshot of the current view to use as the campus thumbnail.
 */
export interface MappedinViewerHandle {
  /** Take a screenshot of the current scene; returns a PNG data URL. */
  capture(): Promise<string | null>;
  /**
   * Compute + draw a route between two space ids. Returns summary
   * (distance / duration) and the step-by-step instructions, or
   * `null` if MappedIn can't find a path. Lets the consumer page
   * render its own Route view without having to mount the
   * NavigateTab.
   */
  route(
    fromId: string,
    toId: string,
    accessible?: boolean,
  ): Promise<{
    distanceM?: number;
    durationS?: number;
    instructions: Array<{
      text: string;
      /** Optional lat/lng pulled from the instruction's coordinate
       *  — `focusOnCoordinate` accepts this directly. */
      lat?: number;
      lng?: number;
    }>;
  } | null>;
  /** Clear any drawn route. */
  clearRoute(): void;
  /**
   * Switch to the floor a space sits on and frame the camera on it.
   * Used by the consumer Route view to fit the map around the FROM
   * endpoint whenever the visitor picks a new starting point.
   */
  focusOnSpace(spaceId: string): Promise<void>;
  /** Move the camera to a specific lat/lng — used to centre the
   *  view on a tapped instruction step. */
  focusOnCoordinate(lat: number, lng: number): Promise<void>;
}

interface MappedinViewerProps {
  venue: MappedinVenue;
  /** A space id to select + fly to once the venue has loaded. */
  focusSpaceId?: string;
  /** UI locale — defaults to English. */
  locale?: Locale;
  /**
   * If set, the error state renders a "Back" link to this URL so the
   * visitor isn't stranded — e.g. the campus home for the public map.
   */
  homeHref?: string;
  /**
   * Campus accent colour — used for the wayfinding route and the
   * selected-space highlight. Defaults to Klorad blue.
   */
  accentColor?: string;
  /** Show the first-visit tips overlay (public map only). */
  showWelcome?: boolean;
  /**
   * Project id — threaded down to AssistantChat in the Navigate tab
   * so the LLM can query news / events / clubs / dining.
   */
  projectId?: string;
  /** Campus display name — used in the assistant's system prompt. */
  campusName?: string;
  /**
   * Emits the buildings (floor-stacks) list once the venue has
   * loaded. Lets the consumer page render its own buildings list
   * below the map instead of relying on the in-viewer side panel.
   */
  onBuildingsChange?: (buildings: FloorOption[]) => void;
  /** Emits all named spaces once the venue has loaded. The
   *  consumer page filters these to render a building-scoped rooms
   *  list. */
  onSpacesChange?: (spaces: SpaceOption[]) => void;
  /**
   * If set, the viewer reacts to changes here by switching to that
   * building (its first floor) and framing the camera on it. Mirror
   * of `focusSpaceId` for the building granularity.
   */
  focusBuildingId?: string;
  /** Hide the in-viewer mobile FAB + bottom sheet — the consumer
   *  page is rendering its own controls below the map. */
  hideMobilePanel?: boolean;
}

/** Default accent for venues with no branding colour. */
const DEFAULT_ACCENT = "#158ca3";

/**
 * Build a human-readable navigation step from a MappedIn
 * `TDirectionInstruction`. MappedIn returns structured data
 * (action type + bearing + distance) without a pre-formatted
 * sentence; this helper produces the short imperative phrases the
 * consumer's Route view shows.
 */
function formatInstruction(raw: unknown): string {
  // The SDK's shape is `{ action: { type, bearing }, distance, ... }`
  // but we widen the input to `unknown` and sniff so a version
  // bump that shifts the keys (e.g. `actions` plural or
  // `direction` instead of `bearing`) doesn't silently turn the
  // step list into a stream of empty strings.
  if (!raw || typeof raw !== "object") return "";
  const i = raw as {
    action?: { type?: string; bearing?: string };
    actions?: Array<{ type?: string; bearing?: string }>;
    type?: string;
    bearing?: string;
    distance?: number;
  };
  const distanceM = i.distance ?? 0;
  const distSuffix =
    distanceM > 1 ? ` for ${Math.round(distanceM)} m` : "";
  const action =
    i.action ?? i.actions?.[0] ?? { type: i.type, bearing: i.bearing };
  const type = action.type;
  const bearing = action.bearing;
  switch (type) {
    case "Departure":
      return "Start your journey";
    case "Arrival":
      return "You've arrived at your destination";
    case "TakeConnection":
      return "Take the connection to the next floor";
    case "ExitConnection":
      return "Exit and continue";
    case "Turn":
      switch (bearing) {
        case "Straight":
          return `Continue straight${distSuffix}`;
        case "Right":
          return `Turn right${distSuffix}`;
        case "SlightRight":
          return `Bear right${distSuffix}`;
        case "Left":
          return `Turn left${distSuffix}`;
        case "SlightLeft":
          return `Bear left${distSuffix}`;
        case "Back":
          return `Turn around${distSuffix}`;
        default:
          return `Continue${distSuffix}`;
      }
    default:
      // No recognised action — surface the distance so the visitor
      // at least sees the segment instead of a blank list.
      return distanceM > 1 ? `Continue${distSuffix}` : "";
  }
}

/** Format a route's metric summary — "120 m · ~2 min". */
function formatRouteSummary(
  distanceM: number | undefined,
  durationS: number | undefined,
): string | null {
  const parts: string[] = [];
  if (typeof distanceM === "number" && Number.isFinite(distanceM)) {
    parts.push(
      distanceM >= 1000
        ? `${(distanceM / 1000).toFixed(1)} km`
        : `${Math.round(distanceM)} m`,
    );
  }
  // Walking-pace fallback (~1.4 m/s) if the SDK didn't surface duration.
  const seconds =
    typeof durationS === "number" && Number.isFinite(durationS)
      ? durationS
      : typeof distanceM === "number" && Number.isFinite(distanceM)
        ? distanceM / 1.4
        : undefined;
  if (seconds !== undefined) {
    parts.push(`~${Math.max(1, Math.round(seconds / 60))} min`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

export const MappedinViewer = forwardRef<
  MappedinViewerHandle,
  MappedinViewerProps
>(function MappedinViewer(
  {
    venue,
    focusSpaceId,
    locale = "en",
    homeHref,
    accentColor = DEFAULT_ACCENT,
    showWelcome = false,
    projectId,
    campusName,
    onBuildingsChange,
    onSpacesChange,
    focusBuildingId,
    hideMobilePanel = false,
  },
  ref,
) {
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
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
  const [routeSummary, setRouteSummary] = useState<string | null>(null);
  const [routeInstructions, setRouteInstructions] = useState<string[]>([]);
  const [floors, setFloors] = useState<FloorOption[]>([]);
  const [currentFloorId, setCurrentFloorId] = useState("");
  const [buildings, setBuildings] = useState<FloorOption[]>([]);
  const [currentBuildingId, setCurrentBuildingId] = useState("");
  // On phones the side panel is a bottom-sheet that lifts on tap.
  // Default closed so the map gets the full screen.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedSpace, setSelectedSpace] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Rooms shown in the selectors / search are scoped to the active
  // building — picking a building filters the world down. Spaces
  // whose buildingId is missing (data quirk) stay visible so we
  // never hide everything by accident.
  const visibleSpaces = useMemo(() => {
    if (!currentBuildingId) return spaces;
    return spaces.filter(
      (s) => !s.buildingId || s.buildingId === currentBuildingId,
    );
  }, [spaces, currentBuildingId]);

  // Highlight a space (accent fill), reverting any previous one — the
  // shared mechanism behind both search and click selection. The
  // accent matches the campus's branding colour.
  const highlightSpace = useCallback(
    (space: Space) => {
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
        mapView.updateState(space, { color: accentColor });
      } catch {
        /* ignore */
      }
    },
    [accentColor],
  );

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

    /**
     * The container may have 0 dimensions on the first effect tick —
     * the flex chain (h-screen → flex-1 → absolute inset-0) hasn't
     * resolved yet, or React StrictMode is mid-cycle. `show3dMap`
     * throws synchronously when the container is sized 0×0 and the
     * SDK gives up on the outdoor view for that mount, leaving the
     * scene white outside the venue. Wait until the container has
     * positive dimensions before kicking the SDK off.
     */
    const waitForSize = (el: HTMLElement) =>
      new Promise<void>((resolve) => {
        if (el.clientWidth > 0 && el.clientHeight > 0) {
          resolve();
          return;
        }
        const ro = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const { width, height } = entry.contentRect;
            if (width > 0 && height > 0) {
              ro.disconnect();
              resolve();
              return;
            }
          }
        });
        ro.observe(el);
      });

    void (async () => {
      const el = containerRef.current;
      if (!el) return;
      setStatus("loading");
      setError(null);
      try {
        await waitForSize(el);
        if (cancelled) return;
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

        // Outdoor MapLibre basemap. The SDK enables it automatically
        // when the venue carries an `outdoorViewToken`, and falls
        // back to the default style configured on the venue itself
        // in the MappedIn dashboard (e.g. "freshmint"). We just flip
        // visibility on in case it loaded hidden — the style and
        // token are venue-side concerns. When `enabled === false`
        // the venue doesn't have outdoor view provisioned at all
        // (most Maker / demo accounts don't include it).
        try {
          const outdoor = (view as {
            Outdoor?: {
              enabled?: boolean;
              show?: () => void;
            };
          }).Outdoor;
          if (outdoor?.enabled !== false) {
            outdoor?.show?.();
          }
        } catch (err) {
          console.warn("[mappedin] outdoor basemap unavailable", err);
        }

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
        const loadedSpaces = [...byId.values()]
          .map((s) => {
            // Reach through the SDK shape — Space.floor.floorStack.id —
            // so we can filter the selectors to the active building.
            const withFloor = s as {
              type?: string;
              floor?: { floorStack?: { id?: string } };
            };
            return {
              id: s.id,
              name: s.name as string,
              type: withFloor.type,
              buildingId: withFloor.floor?.floorStack?.id,
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name));
        setSpaces(loadedSpaces);
        onSpacesChange?.(loadedSpaces);
        // Buildings (floor-stacks) for the exploration controls.
        const loadedBuildings = mapData
          .getByType("floor-stack")
          .map((s) => ({ id: s.id, name: s.name ?? "Building" }));
        setBuildings(loadedBuildings);
        onBuildingsChange?.(loadedBuildings);
        syncFloors();
        setStatus("ready");
      } catch (e) {
        if (cancelled) return;
        // The MappedIn SDK uses internal AbortControllers — when the
        // effect cleanup tears the viewer down mid-load (StrictMode in
        // dev, soft-nav in prod), the in-flight fetch for sprite.json /
        // map tiles rejects with an AbortError. We've already returned
        // on `cancelled` above for the truly-stale path; if we land here
        // with an abort we still want to swallow it instead of showing
        // a load-failure card to the visitor.
        const msg = e instanceof Error ? e.message : "";
        if (
          (e instanceof Error && e.name === "AbortError") ||
          /aborted|signal is aborted/i.test(msg)
        ) {
          return;
        }
        setError(msg || "Failed to load the indoor map");
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

  const handleRoute = useCallback(
    async (fromId: string, toId: string, accessible: boolean) => {
      const mapData = mapDataRef.current;
      const mapView = mapViewRef.current;
      if (!mapData || !mapView) return;
      const from = spacesRef.current.get(fromId);
      const to = spacesRef.current.get(toId);
      if (!from || !to) return;

      setRouting(true);
      setRouteError(null);
      setRouteSummary(null);
      setRouteInstructions([]);
      try {
        mapView.Navigation.clear();
        const directions = await mapData.getDirections(
          from,
          to,
          accessible ? { accessible: true } : undefined,
        );
        if (!directions) {
          setRouteError(
            accessible
              ? translate(locale, "mappedin.wayfindNoStepFree")
              : translate(locale, "mappedin.wayfindNoRoute"),
          );
          return;
        }
        await mapView.Navigation.draw(directions, {
          pathOptions: { color: accentColor },
        });
        const d = directions as {
          distance?: number;
          duration?: number;
          instructions?: Array<{ instruction?: string }>;
        };
        setRouteSummary(formatRouteSummary(d.distance, d.duration));
        setRouteInstructions(
          (d.instructions ?? [])
            .map((i) => (i.instruction ?? "").trim())
            .filter(Boolean),
        );
      } catch {
        setRouteError(translate(locale, "mappedin.wayfindFailed"));
      } finally {
        setRouting(false);
      }
    },
    [locale, accentColor],
  );

  const handleClear = useCallback(() => {
    mapViewRef.current?.Navigation.clear();
    setRouteError(null);
    setRouteSummary(null);
    setRouteInstructions([]);
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

  // Deep link — focus the space named by `focusSpaceId` once the
  // venue has loaded. Re-fires when `focusSpaceId` changes so a
  // soft-nav between rooms (news post → news post) refocuses.
  useEffect(() => {
    if (status !== "ready" || !focusSpaceId) return;
    void handleSearchSelect(focusSpaceId);
  }, [status, focusSpaceId, handleSearchSelect]);

  const handleSelectBuildingRef = useRef<((id: string) => void) | null>(null);
  useEffect(() => {
    if (status !== "ready" || !focusBuildingId) return;
    handleSelectBuildingRef.current?.(focusBuildingId);
  }, [status, focusBuildingId]);

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
      // Frame the camera on the new building so the visitor sees a
      // jump, not just a floor-stack swap behind the scenes. The
      // active floor is a viewable target the SDK can focus.
      const floor = mapView.currentFloor;
      if (floor) {
        try {
          await mapView.Camera.focusOn(floor);
        } catch {
          /* some SDK builds don't accept a Floor — silently ignore */
        }
      }
    },
    [syncFloors],
  );

  // Keep the ref in sync with the latest `handleSelectBuilding`
  // closure so the `focusBuildingId` effect above can call into it
  // without depending on the callback identity.
  useEffect(() => {
    handleSelectBuildingRef.current = (id: string) => {
      void handleSelectBuilding(id);
    };
  }, [handleSelectBuilding]);

  // Imperative handle — capture the current view as a PNG data URL.
  // Used by the dashboard's Indoor tab to set the campus thumbnail.
  useImperativeHandle(
    ref,
    () => ({
      async capture(): Promise<string | null> {
        const mv = mapViewRef.current as
          | (MapView & {
              takeScreenshot?: (opts?: {
                withOutdoorContext?: boolean;
                withLabels?: boolean;
              }) => Promise<string>;
            })
          | null;
        if (!mv?.takeScreenshot) return null;
        try {
          return await mv.takeScreenshot({
            withOutdoorContext: true,
            withLabels: true,
          });
        } catch {
          return null;
        }
      },
      async route(
        fromId: string,
        toId: string,
        accessible?: boolean,
      ) {
        const mapView = mapViewRef.current;
        const mapData = mapDataRef.current;
        const from = spacesRef.current.get(fromId);
        const to = spacesRef.current.get(toId);
        if (!mapView || !mapData || !from || !to) return null;
        try {
          mapView.Navigation.clear();
          const directions = await mapData.getDirections(
            from,
            to,
            accessible ? { accessible: true } : undefined,
          );
          if (!directions) return null;
          await mapView.Navigation.draw(directions, {
            pathOptions: { color: accentColor },
          });
          // Note: we deliberately don't re-frame the camera here.
          // Framing the whole route on cross-building paths zooms
          // out so far the start point becomes invisible. The page
          // calls `focusOnSpace(fromId)` whenever the FROM changes
          // (initial route + any picker change on the FROM side),
          // which gives the visitor a stable "here's where you
          // start" view even when the destination is far away.
          // MappedIn's `Directions` carries an `instructions` array of
          // structured steps — `formatInstruction` turns each one
          // into an imperative sentence. We probe both `instructions`
          // and `path` because SDK builds have shipped both keys.
          const d = directions as {
            distance?: number;
            duration?: number;
            instructions?: unknown[];
            path?: unknown[];
          };
          const rawSteps = d.instructions ?? d.path ?? [];
          return {
            distanceM: d.distance,
            durationS: d.duration,
            instructions: rawSteps.flatMap((step) => {
              const text = formatInstruction(step);
              if (!text) return [];
              const coord = (
                step as {
                  coordinate?: {
                    latitude?: number;
                    longitude?: number;
                  };
                }
              ).coordinate;
              return [
                {
                  text,
                  lat: coord?.latitude,
                  lng: coord?.longitude,
                },
              ];
            }),
          };
        } catch {
          return null;
        }
      },
      clearRoute() {
        mapViewRef.current?.Navigation.clear();
      },
      async focusOnCoordinate(lat: number, lng: number) {
        const mapView = mapViewRef.current;
        if (!mapView) return;
        // Try the SDK's flexible `focusOn` with a coordinate-shaped
        // arg; some builds need a wrapped target. Best-effort — a
        // bad shape never throws to the caller.
        const cam = mapView.Camera as unknown as {
          focusOn: (target: unknown) => Promise<void>;
        };
        try {
          await cam.focusOn({ latitude: lat, longitude: lng });
        } catch {
          try {
            await cam.focusOn({
              type: "Point",
              coordinates: [lng, lat],
            });
          } catch {
            /* ignore */
          }
        }
      },
      async focusOnSpace(spaceId: string) {
        const mapView = mapViewRef.current;
        const space = spacesRef.current.get(spaceId);
        if (!mapView || !space) return;
        // Switch to the space's floor first so the camera move is
        // visible (focusing on a space whose floor isn't current
        // looks like nothing happened). Then frame on the space.
        try {
          if (space.floor) {
            await mapView.setFloor(space.floor);
            syncFloors();
          }
        } catch {
          /* ignore — fall through and try to focus anyway */
        }
        try {
          await mapView.Camera.focusOn(space);
        } catch {
          /* ignore */
        }
      },
    }),
    [accentColor],
  );

  /** Shared panel content — mounted on the desktop aside and in the
   *  mobile bottom sheet. */
  const panelContent = (
    <SidePanel
      locale={locale}
      spaces={visibleSpaces}
      allSpaces={spaces}
      onSearchSelect={(id) => {
        setSheetOpen(false);
        void handleSearchSelect(id);
      }}
      selectedSpace={selectedSpace}
      onClearSelection={clearSelection}
      floors={floors}
      currentFloorId={currentFloorId}
      buildings={buildings}
      currentBuildingId={currentBuildingId}
      onSelectFloor={(id) => void handleSelectFloor(id)}
      onSelectBuilding={(id) => void handleSelectBuilding(id)}
      routing={routing}
      routeError={routeError}
      routeSummary={routeSummary}
      routeInstructions={routeInstructions}
      projectId={projectId}
      campusName={campusName}
      onRoute={(from, to, accessible) => {
        setSheetOpen(false);
        void handleRoute(from, to, accessible);
      }}
      onClearRoute={handleClear}
    />
  );

  return (
    <div className="relative flex h-full w-full">
      {/* Desktop: in-flow left aside. Hidden on mobile so the map fills the screen. */}
      <aside
        className={`h-full w-80 shrink-0 border-r border-solid border-line-soft ${
          hideMobilePanel ? "hidden" : "hidden md:block"
        }`}
      >
        {panelContent}
      </aside>

      <div className="relative min-h-0 flex-1">
        {/* Explicit width + height instead of `absolute inset-0`.
            The flex parent was measuring 0×0 at the moment
            MappedIn's outdoor view tried to read it; depending on
            the flex chain to propagate dimensions through three
            layers is too fragile. `width: 100%; height: 100%`
            fills whatever the parent ends up being, and explicit
            minimums keep it positive even if a transient layout
            flush would otherwise collapse the parent. */}
        <div
          ref={containerRef}
          className="absolute inset-0"
          style={{
            width: "100%",
            height: "100%",
            minWidth: "100%",
            minHeight: "100%",
          }}
        />

        {/* Mobile FAB to open the bottom sheet. Hidden when the
            consumer page renders its own controls below the map. */}
        {hideMobilePanel ? null : (
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="absolute right-4 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-20 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-accent-contrast shadow-glass md:hidden"
            aria-label={t("mappedin.menu")}
          >
            <Menu size={16} strokeWidth={2} />
            {t("mappedin.menu")}
          </button>
        )}

        {status === "loading" ? (
          <div className="pointer-events-none absolute inset-0 animate-pulse bg-surface-2/40">
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-medium text-text-secondary">
                {t("mappedin.loading")}
              </span>
            </div>
          </div>
        ) : null}

        {status === "error" ? (
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <div className="max-w-sm rounded-2xl border border-solid border-line-soft bg-surface-1 p-5 text-center shadow-glass">
              <p className="text-sm font-medium text-text-primary">
                {t("mappedin.errorTitle")}
              </p>
              <p className="mt-1 text-xs text-text-tertiary">
                {t("mappedin.errorBody")}
              </p>
              {error ? (
                <p className="mt-2 text-[0.65rem] text-text-tertiary opacity-60">
                  {error}
                </p>
              ) : null}
              {homeHref ? (
                <Link
                  href={homeHref}
                  className="mt-4 inline-block text-xs font-medium text-accent transition-opacity hover:opacity-80"
                >
                  ← {t("mappedin.errorBack")}
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}

        {status === "ready" && showWelcome ? (
          <WelcomeOverlay locale={locale} />
        ) : null}
      </div>

      {/* Mobile bottom-sheet — fixed overlay that slides up. Backdrop
          dim closes on tap; the inner panel is a copy of the desktop
          aside so the user has the same Explore / Navigate / chat
          surface without re-typing anything. Suppressed when the
          consumer page renders its own controls below the map. */}
      {sheetOpen && !hideMobilePanel ? (
        <button
          type="button"
          onClick={() => setSheetOpen(false)}
          aria-label={t("mappedin.closeMenu")}
          className="fixed inset-0 z-50 bg-black/40 md:hidden"
        />
      ) : null}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] min-h-[60vh] flex-col rounded-t-2xl bg-surface-1 shadow-glass transition-transform duration-200 ease-out md:hidden ${
          sheetOpen && !hideMobilePanel ? "translate-y-0" : "translate-y-full"
        }`}
        aria-hidden={!sheetOpen || hideMobilePanel}
      >
        <div className="flex items-center justify-between border-b border-solid border-line-soft px-4 py-3">
          <div
            aria-hidden
            className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-line-soft"
          />
          <span className="text-sm font-semibold text-text-primary">
            {campusName ?? t("mappedin.menu")}
          </span>
          <button
            type="button"
            onClick={() => setSheetOpen(false)}
            aria-label={t("mappedin.closeMenu")}
            className="rounded-md p-1 text-text-tertiary transition-colors hover:bg-surface-2 hover:text-text-primary"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{panelContent}</div>
      </div>
    </div>
  );
});
