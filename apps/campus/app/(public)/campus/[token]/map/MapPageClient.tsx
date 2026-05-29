"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Compass, Search, X } from "lucide-react";
// Lucide's `X` is also imported here for the building header's close
// chip. Renamed to disambiguate from the search-clear button below.
import {
  MappedinViewer,
  type MappedinViewerHandle,
} from "@/lib/mappedin/MappedinViewer";
import type { MappedinVenue } from "@/lib/mappedin/config";
import type { Locale } from "@/app/lib/i18n-core";
import {
  BuildingsList,
  type BuildingsListItem,
} from "@/lib/consumer/BuildingsList";
import { BuildingDetailSheet } from "@/lib/consumer/BuildingDetailSheet";
import {
  RouteHeader,
  RouteConfigPanel,
  RouteStatsCard,
  RouteStepsList,
  type RouteStep,
} from "@/lib/consumer/RouteView";
import {
  YOUR_LOCATION_ID,
  type PickerOption,
} from "@/lib/consumer/RouteEndpointPicker";
import type { SpaceOption } from "@/lib/mappedin/WayfindingControls";

interface Props {
  venue: MappedinVenue;
  focusSpaceId?: string;
  locale: Locale;
  homeHref: string;
  accentColor?: string;
  projectId: string;
  campusName: string;
  klioHref: string;
}

const PLACEHOLDER: Record<Locale, string> = {
  en: "Search buildings, events, food…",
  el: "Κτίρια, εκδηλώσεις, φαγητό…",
};

const YOUR_LOCATION_LABEL: Record<Locale, string> = {
  en: "Your location",
  el: "Η τοποθεσία σου",
};

const PICK_TO_LABEL: Record<Locale, string> = {
  en: "Pick a destination",
  el: "Επιλέξτε προορισμό",
};

function buildingInitials(name: string): string {
  const parts = name
    .replace(/[^A-Za-z\s]/g, "")
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean);
  if (parts.length === 0) return "•";
  return parts.slice(0, 3).join("").toUpperCase();
}

interface RouteResult {
  distanceM?: number;
  durationS?: number;
  instructions: RouteStep[];
}

/**
 * Route computation state — distinguishes "still loading", "ready
 * with data", and "MappedIn couldn't find a path" so the bottom
 * panel can show distinct copy for each. Without this the user
 * sees "Calculating route…" forever when no path exists between
 * the two endpoints (e.g., a building's entrance is on a floor
 * that isn't connected to the destination's floor).
 */
type RouteStatus =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; result: RouteResult }
  | { kind: "failed" };

/**
 * Map page orchestrator — holds buildings + spaces + route state.
 * Three rendering modes share the same 4:3 column under the same
 * map: default (search + BuildingsList), building-detail
 * (BuildingDetailSheet + rooms), and route (RouteHeader pickers +
 * RouteDirections panel).
 *
 * Route mode supports deep-linking via the URL — `?route=1` opens
 * empty pickers; `?route=1&to=<spaceId>` pre-fills the destination.
 * That's what the home page's "Directions" tile points at.
 */
export function MapPageClient({
  venue,
  focusSpaceId,
  locale,
  homeHref,
  accentColor,
  projectId,
  campusName,
}: Props) {
  const viewerRef = useRef<MappedinViewerHandle | null>(null);
  const [buildings, setBuildings] = useState<BuildingsListItem[]>([]);
  const [spaces, setSpaces] = useState<SpaceOption[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("");
  const [detailBuildingId, setDetailBuildingId] = useState<string>("");
  const [selectedRoomId, setSelectedRoomId] = useState<string>(
    focusSpaceId ?? "",
  );
  const [query, setQuery] = useState("");

  // ── Route mode state ────────────────────────────────────────────
  const searchParams = useSearchParams();
  const initialTo = searchParams?.get("to") ?? "";
  const initialFrom = searchParams?.get("from") ?? "";
  const routeRequested = searchParams?.get("route") === "1";
  const [routeMode, setRouteMode] = useState<boolean>(routeRequested);
  const [fromId, setFromId] = useState<string>(
    initialFrom || (routeRequested ? YOUR_LOCATION_ID : ""),
  );
  const [toId, setToId] = useState<string>(initialTo);
  const [accessible, setAccessible] = useState(false);
  const [routeStatus, setRouteStatus] = useState<RouteStatus>({ kind: "idle" });
  /** Two-phase route UX. `configuring` shows the toggle + Get
   *  directions CTA in the bottom container; `viewing` swaps that
   *  for the stats card + clickable steps list. Flips to `viewing`
   *  the moment the visitor taps Get directions and stays there
   *  for the rest of the route session. */
  const [routePhase, setRoutePhase] = useState<"configuring" | "viewing">(
    "configuring",
  );
  const [activeStepIndex, setActiveStepIndex] = useState<number>(-1);

  // GPS-derived "from" space id. When the visitor picks "Your
  // location" the browser prompts for permission; on success we
  // pick the closest named space and use *that* as the actual
  // `fromId` for MappedIn's routing API.
  const [gpsFromId, setGpsFromId] = useState<string>("");

  const detailBuilding = useMemo(
    () => buildings.find((b) => b.id === detailBuildingId),
    [buildings, detailBuildingId],
  );
  const detailRooms = useMemo(
    () =>
      detailBuildingId
        ? spaces.filter((s) => s.buildingId === detailBuildingId)
        : [],
    [spaces, detailBuildingId],
  );

  // Picker options — flat list of every named space + the building
  // name as a subtitle so the dropdown reads "Auditorium · Student
  // Union" instead of just the room name. Buildings come first so
  // they're easy to pick for whole-building destinations.
  const pickerOptions: PickerOption[] = useMemo(() => {
    const buildingMap = new Map(buildings.map((b) => [b.id, b.name]));
    const roomOptions = spaces.map((s) => ({
      id: s.id,
      name: s.name,
      subtitle: s.buildingId ? buildingMap.get(s.buildingId) : undefined,
    }));
    const buildingOptions = buildings.map((b) => ({
      id: b.id,
      name: b.name,
      subtitle: undefined,
    }));
    return [...buildingOptions, ...roomOptions];
  }, [buildings, spaces]);

  // Resolve display labels for the picker triggers.
  const optionsById = useMemo(() => {
    const m = new Map<string, PickerOption>();
    for (const o of pickerOptions) m.set(o.id, o);
    return m;
  }, [pickerOptions]);

  const fromLabel =
    fromId === YOUR_LOCATION_ID
      ? YOUR_LOCATION_LABEL[locale]
      : optionsById.get(fromId)?.name ?? PICK_TO_LABEL[locale];
  const toLabel = optionsById.get(toId)?.name ?? PICK_TO_LABEL[locale];

  // ── GPS lookup ─────────────────────────────────────────────────
  // When "Your location" is the from selection, ask the browser for
  // a position and pick the closest named space as the resolved
  // start point. The viewer's spaces don't expose lat/lng on this
  // type, but we read it off the SDK shape — see `SpaceOption`
  // origin. If the venue lacks geo-coordinates or the user denies
  // permission, we fall back to `spaces[0]` so routing still works.
  useEffect(() => {
    if (fromId !== YOUR_LOCATION_ID || spaces.length === 0) {
      setGpsFromId("");
      return;
    }
    if (
      typeof navigator === "undefined" ||
      !("geolocation" in navigator)
    ) {
      setGpsFromId(spaces[0].id);
      return;
    }
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        const closest = findClosestSpace(spaces, pos.coords);
        setGpsFromId(closest ?? spaces[0].id);
      },
      () => {
        if (cancelled) return;
        // Permission denied / unavailable — fall back to first space
        // so the user still gets a route drawn while they iterate.
        setGpsFromId(spaces[0].id);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
    return () => {
      cancelled = true;
    };
  }, [fromId, spaces]);

  // The actual MappedIn space id used for the FROM side of the
  // routing call. `YOUR_LOCATION_ID` resolves via `gpsFromId`;
  // everything else is the picker value directly.
  const resolvedFromId =
    fromId === YOUR_LOCATION_ID ? gpsFromId : fromId;

  // ── Compute the route ───────────────────────────────────────────
  // MappedIn's `getDirections` only accepts Space objects, not
  // floor-stacks (buildings). When either endpoint id is a building,
  // resolve it to the first space inside that building so we can
  // route building↔building, building↔room, and room↔room without
  // surprising the user. Building→spaces lookup is built once per
  // change of either list.
  const spaceIdSet = useMemo(
    () => new Set(spaces.map((s) => s.id)),
    [spaces],
  );
  const firstSpaceByBuilding = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of spaces) {
      if (s.buildingId && !m.has(s.buildingId)) {
        m.set(s.buildingId, s.id);
      }
    }
    return m;
  }, [spaces]);
  const resolveToSpaceId = (id: string): string => {
    if (!id) return "";
    if (spaceIdSet.has(id)) return id;
    return firstSpaceByBuilding.get(id) ?? "";
  };

  // Whenever the FROM endpoint changes (initial entry into route
  // mode or a picker swap on the FROM side), snap the map to the
  // FROM's floor and frame the camera on it. Visitors expect to
  // see "where they're starting" before they hit Start; framing
  // the whole route on cross-building paths leaves the start point
  // off-screen. TO changes don't refocus — the visitor is reading
  // the directions panel and re-framing would be jarring.
  useEffect(() => {
    if (!routeMode || !resolvedFromId) return;
    const fromSpaceId = resolveToSpaceId(resolvedFromId);
    if (!fromSpaceId) return;
    void viewerRef.current?.focusOnSpace(fromSpaceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeMode, resolvedFromId, spaceIdSet, firstSpaceByBuilding]);

  useEffect(() => {
    if (!routeMode || !resolvedFromId || !toId) {
      setRouteStatus({ kind: "idle" });
      return;
    }
    const fromSpaceId = resolveToSpaceId(resolvedFromId);
    const toSpaceId = resolveToSpaceId(toId);
    if (!fromSpaceId || !toSpaceId) {
      setRouteStatus({ kind: "idle" });
      return;
    }
    setRouteStatus({ kind: "loading" });
    let cancelled = false;
    void viewerRef.current
      ?.route(fromSpaceId, toSpaceId, accessible)
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setRouteStatus({ kind: "failed" });
        } else {
          setRouteStatus({ kind: "ready", result });
        }
      });
    return () => {
      cancelled = true;
    };
    // resolveToSpaceId is recomputed each render but reads stable
    // memos — eslint doesn't need it in deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    routeMode,
    resolvedFromId,
    toId,
    accessible,
    spaceIdSet,
    firstSpaceByBuilding,
  ]);

  const enterRoute = (nextToId: string) => {
    setToId(nextToId);
    if (!fromId) setFromId(YOUR_LOCATION_ID);
    setRouteMode(true);
    setRoutePhase("configuring");
    setRouteStatus({ kind: "idle" });
    setActiveStepIndex(-1);
    setDetailBuildingId("");
  };

  const exitRoute = () => {
    setRouteMode(false);
    setRoutePhase("configuring");
    setRouteStatus({ kind: "idle" });
    setActiveStepIndex(-1);
    viewerRef.current?.clearRoute();
  };

  const inRoute = routeMode;
  const inDetail = !inRoute && detailBuilding !== undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Top slot — search by default, RouteHeader in route mode. */}
      {inRoute ? (
        <RouteHeader
          fromValue={fromId}
          fromLabel={fromLabel}
          toValue={toId}
          toLabel={toLabel}
          options={pickerOptions}
          onChangeFrom={setFromId}
          onChangeTo={setToId}
          onBack={exitRoute}
          locale={locale}
        />
      ) : (
        <div className="bg-[var(--brand-page)] px-4 pt-3 pb-3 md:px-6">
          <div className="flex items-center gap-2 rounded-full bg-white px-4 py-3 shadow-sm">
            <Search
              size={16}
              strokeWidth={2}
              className="shrink-0 text-[var(--brand-text-muted)]"
              aria-hidden
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={PLACEHOLDER[locale]}
              className="min-w-0 flex-1 bg-transparent text-sm text-[var(--brand-text)] outline-none placeholder:text-[var(--brand-text-muted)]"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[var(--brand-text-muted)] hover:text-[var(--brand-text)]"
              >
                <X size={14} strokeWidth={2} />
              </button>
            ) : null}
          </div>
        </div>
      )}

      {/* Map — 4 parts of the 4:3 split. On mobile the map runs
          edge-to-edge (no padding, no rounded card) so the bottom
          sheet can overlap it via its negative top margin; the
          rounded-card treatment is desktop-only. */}
      <div
        className="min-h-0 md:px-6 md:pt-3"
        style={{ flex: "4 1 0" }}
      >
        <div className="h-full overflow-hidden bg-white md:rounded-2xl">
          <MappedinViewer
            ref={viewerRef}
            venue={venue}
            focusSpaceId={selectedRoomId || focusSpaceId}
            focusBuildingId={selectedBuildingId || undefined}
            locale={locale}
            homeHref={homeHref}
            accentColor={accentColor}
            projectId={projectId}
            campusName={campusName}
            showWelcome
            hideMobilePanel
            onBuildingsChange={setBuildings}
            onSpacesChange={setSpaces}
          />
        </div>
      </div>

      {/* Bottom container — sheet-style on mobile: rounded top
          corners + negative margin so it visibly overlaps the map.
          Desktop keeps the in-flow 4:3 layout (no overlap, no
          rounding). The optional building header is rendered as a
          fixed sibling so the title stays still while rooms scroll;
          the scroll surface ends with `pb-24` to clear the
          floating nav. */}
      <div
        className="relative z-10 -mt-6 flex min-h-0 flex-col rounded-t-3xl bg-[var(--brand-page)] md:mt-0 md:rounded-none"
        style={{ flex: "3 1 0" }}
      >
        {inRoute && routePhase === "viewing" ? (
          <RouteStatsCard
            status={routeStatus.kind}
            distanceM={
              routeStatus.kind === "ready"
                ? routeStatus.result.distanceM
                : undefined
            }
            durationS={
              routeStatus.kind === "ready"
                ? routeStatus.result.durationS
                : undefined
            }
            stepCount={
              routeStatus.kind === "ready"
                ? routeStatus.result.instructions.length
                : 0
            }
            accessible={accessible}
            locale={locale}
          />
        ) : null}
        {inDetail && detailBuilding ? (
          <div className="flex items-center gap-3 bg-[var(--brand-page)] px-4 pt-4 pb-3 md:px-6">
            <span
              aria-hidden
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[10px] font-bold tracking-wide"
              style={{
                backgroundColor:
                  "color-mix(in srgb, var(--brand-primary) 14%, #ffffff)",
                color: "var(--brand-primary)",
              }}
            >
              {buildingInitials(detailBuilding.name)}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-semibold text-[var(--brand-text)]">
                {detailBuilding.name}
              </h2>
              <p className="text-xs text-[var(--brand-text-muted)]">
                {detailRooms.length}{" "}
                {locale === "el" ? "δωμάτια" : "rooms"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setDetailBuildingId("");
                setSelectedRoomId("");
              }}
              aria-label={locale === "el" ? "Κλείσιμο" : "Close"}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[var(--brand-text-muted)] transition-colors hover:text-[var(--brand-text)]"
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto pb-24">
          {inRoute ? (
            routePhase === "configuring" ? (
              <RouteConfigPanel
                accessible={accessible}
                onToggleAccessible={(next) => {
                  setAccessible(next);
                  setRouteStatus({ kind: "idle" });
                }}
                onGetDirections={() => {
                  setRoutePhase("viewing");
                  setActiveStepIndex(-1);
                }}
                status={routeStatus.kind}
                locale={locale}
              />
            ) : (
              <RouteStepsList
                steps={
                  routeStatus.kind === "ready"
                    ? routeStatus.result.instructions
                    : []
                }
                activeIndex={activeStepIndex}
                onSelectStep={(idx) => {
                  if (routeStatus.kind !== "ready") return;
                  setActiveStepIndex(idx);
                  const step = routeStatus.result.instructions[idx];
                  if (step?.lat !== undefined && step?.lng !== undefined) {
                    void viewerRef.current?.focusOnCoordinate(
                      step.lat,
                      step.lng,
                    );
                  }
                }}
                locale={locale}
                status={routeStatus.kind}
              />
            )
          ) : inDetail && detailBuilding ? (
            <BuildingDetailSheet
              rooms={detailRooms.map((r) => ({ id: r.id, name: r.name }))}
              selectedRoomId={selectedRoomId}
              locale={locale}
              onSelectRoom={(id) => {
                setSelectedRoomId((current) => (current === id ? "" : id));
                setSelectedBuildingId(detailBuilding.id);
              }}
            />
          ) : (
            <BuildingsList
              items={buildings}
              selectedId={selectedBuildingId}
              onSelect={setSelectedBuildingId}
              onOpenDetail={setDetailBuildingId}
              query={query}
              locale={locale}
            />
          )}
        </div>
      </div>

      {/* Floating "Get directions" CTA — pinned above the bottom
          nav while a building's detail sheet is open. Lives outside
          the scrolling container so it doesn't scroll with the rooms
          list, and at z-50 to clear the nav's gradient overlay (which
          sits at z-40-1). The rooms list now fills the entire bottom
          container; the button overlays the gradient. */}
      {inDetail && detailBuilding ? (
        <div
          className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4 md:px-6"
          style={{
            bottom:
              "calc(env(safe-area-inset-bottom) + 4.25rem)",
          }}
        >
          <button
            type="button"
            onClick={() => {
              const targetId =
                selectedRoomId || detailRooms[0]?.id || "";
              if (!targetId) return;
              enterRoute(targetId);
            }}
            className="pointer-events-auto inline-flex w-full max-w-[420px] items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--brand-primary)" }}
          >
            <Compass size={16} strokeWidth={2} />
            {locale === "el" ? "Οδηγίες" : "Get directions"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Pick the named space closest to the given GPS coordinate by
 * Haversine distance. Returns `null` when no space exposes
 * lat/lng. The SDK keeps these on the underlying object behind
 * `.center` or `.coordinate` depending on the model — we sniff
 * both, treating missing data as a non-match.
 */
function findClosestSpace(
  spaces: SpaceOption[],
  coords: GeolocationCoordinates,
): string | null {
  // SpaceOption is a thin projection; reach back into the SDK
  // shape kept on the same object instance via `unknown` cast.
  type WithGeo = SpaceOption & {
    center?: { latitude?: number; longitude?: number };
    coordinate?: { latitude?: number; longitude?: number };
  };
  let bestId: string | null = null;
  let bestDist = Infinity;
  for (const s of spaces as WithGeo[]) {
    const lat = s.center?.latitude ?? s.coordinate?.latitude;
    const lng = s.center?.longitude ?? s.coordinate?.longitude;
    if (lat === undefined || lng === undefined) continue;
    const d = haversine(coords.latitude, coords.longitude, lat, lng);
    if (d < bestDist) {
      bestDist = d;
      bestId = s.id;
    }
  }
  return bestId;
}

/** Great-circle distance in metres. */
function haversine(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
