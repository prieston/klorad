"use client";

import { useMemo, useState } from "react";
import type { FloorPlan, POI, Room } from "@klorad/api";
import { useSceneStore } from "@klorad/core";
import type { Entity, View, ViewProps } from "@klorad/config/workbench";
import {
  ContextMenu,
  Button,
  cn,
} from "@klorad/design-system";
import type { Map as MapboxMap } from "mapbox-gl";
import type { Building } from "../entities/building";
import { useCampusApiStore } from "../campus-api-store";

/**
 * Workflow view — the left dock's whole panel.
 *
 * Three tabs that mirror the order a real campus author works in:
 *
 *   1. Location — set where the campus sits on the map. Captured
 *      from the current Mapbox view; used as the initial camera
 *      pose every time the world loads.
 *   2. Buildings — draw / select / drill into buildings. Each
 *      building can be opened to reveal its floors; each floor to
 *      reveal its rooms. Internal navigation stays inside this tab.
 *   3. POIs — tag the places visitors search for. Live-filtered.
 *
 * Save + share live in the top bar (not here). World-level actions
 * stay in the right panel's Overview view.
 *
 * The same WORKFLOW pattern is the spec for every Klorad vertical's
 * left dock — three to five guided steps in the order an author
 * naturally builds. When the second vertical ships, this generalises
 * into a DS `WorkflowPanel` primitive.
 */
function WorkflowViewComponent({ ctx }: ViewProps) {
  const [step, setStep] = useState<StepId>("location");

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <header className="px-4 pb-2 pt-1">
        <h2 className="text-base font-semibold tracking-tight text-text-primary">
          Workflow
        </h2>
      </header>

      <TabBar current={step} onChange={setStep} />

      <div className="border-b border-line-soft px-4 py-3">
        <p className="text-xs leading-relaxed text-text-secondary">
          {STEPS.find((s) => s.id === step)?.description}
        </p>
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-3">
        {step === "location" ? <LocationStep /> : null}
        {step === "buildings" ? <BuildingsStep ctx={ctx} /> : null}
        {step === "pois" ? <PoisStep ctx={ctx} /> : null}
      </div>
    </div>
  );
}

/* ─── Tab bar ─────────────────────────────────────────────────────── */

type StepId = "location" | "buildings" | "pois";

const STEPS: { id: StepId; label: string; description: string }[] = [
  {
    id: "location",
    label: "Location",
    description: "Define where your campus sits. The current map view becomes the initial camera position visitors land on.",
  },
  {
    id: "buildings",
    label: "Buildings",
    description: "Draw your campus's buildings, then drill into each one to add floors and rooms.",
  },
  {
    id: "pois",
    label: "POIs",
    description: "Tag the places visitors search for — entrances, departments, cafés, accessibility info.",
  },
];

function TabBar({
  current,
  onChange,
}: {
  current: StepId;
  onChange: (s: StepId) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1 px-3 pb-2">
      {STEPS.map((s, i) => {
        const isActive = s.id === current;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange(s.id)}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 rounded-xl py-2 transition-colors",
              isActive
                ? "bg-accent-soft text-accent"
                : "text-text-tertiary hover:bg-surface-2 hover:text-text-primary",
            )}
          >
            <span className="font-mono text-[0.6rem] tabular-nums opacity-70">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="text-[0.75rem] font-medium">{s.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ─── Step 1 · Location ───────────────────────────────────────────── */

function LocationStep() {
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
      <div className="rounded-2xl bg-surface-2 p-4">
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
        <div className="rounded-2xl bg-surface-2 p-4">
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

/** Renders the live map center + zoom — re-reads on each render. */
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

/* ─── Step 2 · Buildings ──────────────────────────────────────────── */

function BuildingsStep({ ctx }: { ctx: ViewProps["ctx"] }) {
  // Drill stack — empty = building list, [id] = inside a building,
  // [id, floorId] = inside a floor. Pop to navigate up.
  const [drill, setDrill] = useState<string[]>([]);

  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    entityId: string;
  } | null>(null);
  const openMenu = (e: React.MouseEvent, entityId: string) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, entityId });
  };

  const buildings = ctx.entities.byType(
    "campus.building",
  ) as Entity<Building>[];

  let content: React.ReactNode;
  if (drill.length === 0) {
    content = (
      <BuildingsList
        ctx={ctx}
        buildings={buildings}
        onDrill={(id) => setDrill([id])}
        onContextMenu={openMenu}
      />
    );
  } else if (drill.length === 1) {
    const buildingId = drill[0];
    const building = buildings.find((b) => b.id === buildingId);
    content = (
      <BuildingDetail
        ctx={ctx}
        buildingId={buildingId}
        buildingName={building?.payload.name ?? "Unnamed building"}
        onBack={() => setDrill([])}
        onDrillFloor={(floorId) => setDrill([buildingId, floorId])}
        onContextMenu={openMenu}
      />
    );
  } else {
    const [buildingId, floorId] = drill;
    content = (
      <FloorDetail
        ctx={ctx}
        floorId={floorId}
        onBack={() => setDrill([buildingId])}
        onContextMenu={openMenu}
      />
    );
  }

  return (
    <>
      {content}
      {menu ? (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          operations={ctx.operationsForEntity(menu.entityId)}
          onRun={(resolved) =>
            void ctx.runOperation(
              resolved.operation.id,
              undefined,
              resolved.on,
            )
          }
          onClose={() => setMenu(null)}
        />
      ) : null}
    </>
  );
}

function BuildingsList({
  ctx,
  buildings,
  onDrill,
  onContextMenu,
}: {
  ctx: ViewProps["ctx"];
  buildings: Entity<Building>[];
  onDrill: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
}) {
  if (buildings.length === 0) {
    return (
      <EmptyHint
        title="No buildings yet"
        body="Use ⌘K → “Draw building” to trace one on the map."
      />
    );
  }
  const selectedId = ctx.selection.focusedId;
  return (
    <div className="space-y-2">
      {buildings.map((b) => {
        const isSelected = b.id === selectedId;
        const floorCount = ctx.entities
          .byType("campus.floor-plan")
          .filter(
            (f) =>
              (f.payload as FloorPlan).buildingId === b.id,
          ).length;
        return (
          <div
            key={b.id}
            className={cn(
              "group flex items-center gap-2 rounded-2xl p-4 transition-colors",
              isSelected
                ? "bg-accent-soft"
                : "bg-surface-2 hover:bg-accent-soft/40",
            )}
          >
            <button
              type="button"
              onClick={() => {
                ctx.setSelection({
                  ids: new Set([b.id]),
                  focusedId: b.id,
                });
              }}
              onContextMenu={(e) => onContextMenu(e, b.id)}
              className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left"
            >
              <span
                className={cn(
                  "truncate text-[0.8125rem] font-medium",
                  isSelected ? "text-accent" : "text-text-primary",
                )}
              >
                {b.payload.name || "Unnamed building"}
              </span>
              <span className="text-[0.7rem] text-text-tertiary">
                {floorCount} floor{floorCount === 1 ? "" : "s"}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onDrill(b.id)}
              aria-label={`Open ${b.payload.name || "building"}`}
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
                isSelected
                  ? "text-accent hover:bg-accent/15"
                  : "text-text-tertiary hover:bg-bg hover:text-text-primary",
              )}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function BuildingDetail({
  ctx,
  buildingId,
  buildingName,
  onBack,
  onDrillFloor,
  onContextMenu,
}: {
  ctx: ViewProps["ctx"];
  buildingId: string;
  buildingName: string;
  onBack: () => void;
  onDrillFloor: (floorId: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
}) {
  const floors = useMemo(() => {
    return ctx.entities
      .byType("campus.floor-plan")
      .filter(
        (f) => (f.payload as FloorPlan).buildingId === buildingId,
      )
      .sort(
        (a, b) =>
          ((a.payload as FloorPlan).floor ?? 0) -
          ((b.payload as FloorPlan).floor ?? 0),
      );
  }, [ctx.entities, buildingId]);

  return (
    <div className="space-y-3">
      <DrillHeader label={buildingName} onBack={onBack} />
      {floors.length === 0 ? (
        <EmptyHint
          title="No floors yet"
          body="Use ⌘K → “Upload floor plan” to add one."
        />
      ) : (
        <div className="space-y-2">
          {floors.map((f) => {
            const plan = f.payload as FloorPlan;
            const isSelected = ctx.selection.focusedId === f.id;
            const code = floorCode(plan.floor);
            const label =
              plan.name ??
              (plan.floor !== undefined ? `Floor ${plan.floor}` : "Floor");
            const roomCount = ctx.entities
              .byType("campus.room")
              .filter(
                (r) =>
                  (r.payload as Room).buildingId === buildingId &&
                  (r.payload as Room).floor === plan.floor,
              ).length;
            return (
              <div
                key={f.id}
                className={cn(
                  "group flex items-center gap-2 rounded-2xl p-3.5 transition-colors",
                  isSelected
                    ? "bg-accent-soft"
                    : "bg-surface-2 hover:bg-accent-soft/40",
                )}
              >
                <button
                  type="button"
                  onClick={() =>
                    ctx.setSelection({
                      ids: new Set([f.id]),
                      focusedId: f.id,
                    })
                  }
                  onContextMenu={(e) => onContextMenu(e, f.id)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                >
                  <FloorBadge code={code} selected={isSelected} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span
                      className={cn(
                        "truncate text-[0.8125rem] font-medium",
                        isSelected ? "text-accent" : "text-text-primary",
                      )}
                    >
                      {label}
                    </span>
                    <span className="text-[0.7rem] text-text-tertiary">
                      {roomCount} room{roomCount === 1 ? "" : "s"}
                    </span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => onDrillFloor(f.id)}
                  aria-label={`Open ${label}`}
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
                    isSelected
                      ? "text-accent hover:bg-accent/15"
                      : "text-text-tertiary hover:bg-bg hover:text-text-primary",
                  )}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FloorDetail({
  ctx,
  floorId,
  onBack,
  onContextMenu,
}: {
  ctx: ViewProps["ctx"];
  floorId: string;
  onBack: () => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
}) {
  const floorEntity = ctx.entities.byId(floorId);
  const plan = floorEntity?.payload as FloorPlan | undefined;
  const rooms = useMemo(() => {
    if (!plan) return [];
    return ctx.entities.byType("campus.room").filter(
      (r) =>
        (r.payload as Room).buildingId === plan.buildingId &&
        (r.payload as Room).floor === plan.floor,
    );
  }, [ctx.entities, plan]);

  const label =
    plan?.name ??
    (plan?.floor !== undefined ? `Floor ${plan.floor}` : "Floor");

  return (
    <div className="space-y-3">
      <DrillHeader label={label} onBack={onBack} />
      {rooms.length === 0 ? (
        <EmptyHint
          title="No rooms yet"
          body="Use ⌘K → “Define room” to draw one inside this floor."
        />
      ) : (
        <div className="space-y-1.5">
          {rooms.map((r) => {
            const room = r.payload as Room;
            const isSelected = ctx.selection.focusedId === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() =>
                  ctx.setSelection({
                    ids: new Set([r.id]),
                    focusedId: r.id,
                  })
                }
                onContextMenu={(e) => onContextMenu(e, r.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-2xl p-3 text-left transition-colors",
                  isSelected
                    ? "bg-accent-soft text-accent"
                    : "bg-surface-2 text-text-secondary hover:bg-accent-soft/40 hover:text-text-primary",
                )}
              >
                <span
                  className={cn(
                    "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                    isSelected ? "bg-accent" : "bg-text-tertiary/40",
                  )}
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[0.8125rem] font-medium">
                    {room.name || "Unnamed room"}
                  </span>
                  {room.type ? (
                    <span className="truncate text-[0.65rem] uppercase tracking-[0.06em] text-text-tertiary">
                      {room.type}
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Step 3 · POIs ───────────────────────────────────────────────── */

function PoisStep({ ctx }: { ctx: ViewProps["ctx"] }) {
  const pois = ctx.entities.byType("campus.poi") as Entity<POI>[];
  const selectedId = ctx.selection.focusedId;
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    entityId: string;
  } | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pois;
    return pois.filter((e) => {
      const poi = e.payload;
      const haystack = [poi.name, poi.category, poi.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [pois, query]);

  if (pois.length === 0) {
    return (
      <EmptyHint
        title="No POIs yet"
        body="Use ⌘K → “Place POI” to drop one on the map."
      />
    );
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <SearchPill value={query} onChange={setQuery} />
      {filtered.length === 0 ? (
        <p className="px-1 py-3 text-center text-xs text-text-tertiary">
          Nothing matches “{query}”.
        </p>
      ) : (
        <ul role="list" className="space-y-2">
          {filtered.map((entity) => {
            const poi = entity.payload;
            const isSelected = entity.id === selectedId;
            const isAccessible = !!poi.accessibility?.wheelchairAccessible;
            return (
              <li key={entity.id}>
                <button
                  type="button"
                  onClick={() => {
                    ctx.setSelection({
                      ids: isSelected
                        ? new Set<string>()
                        : new Set([entity.id]),
                      focusedId: isSelected ? null : entity.id,
                    });
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setMenu({
                      x: e.clientX,
                      y: e.clientY,
                      entityId: entity.id,
                    });
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-2xl p-4 text-left transition-colors",
                    isSelected
                      ? "bg-accent-soft text-accent"
                      : "bg-surface-2 text-text-secondary hover:bg-accent-soft/40 hover:text-text-primary",
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                      isSelected ? "bg-accent" : "bg-text-tertiary/40",
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium">
                    {poi.name || "Unnamed POI"}
                  </span>
                  {isAccessible ? (
                    <span
                      title="Accessible"
                      className={cn(
                        "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                        isSelected ? "bg-accent" : "bg-accent/60",
                      )}
                    />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {menu ? (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          operations={ctx.operationsForEntity(menu.entityId)}
          onRun={(resolved) =>
            void ctx.runOperation(
              resolved.operation.id,
              undefined,
              resolved.on,
            )
          }
          onClose={() => setMenu(null)}
        />
      ) : null}
    </div>
  );
}

function SearchPill({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-2.5 rounded-2xl bg-surface-2 p-4">
      <SearchIcon className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search POIs…"
        className="w-full bg-transparent text-xs text-text-primary placeholder:text-text-tertiary"
      />
    </label>
  );
}

/* ─── Shared bits ─────────────────────────────────────────────────── */

function DrillHeader({
  label,
  onBack,
}: {
  label: string;
  onBack: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="group flex items-center gap-1.5 text-[0.7rem] font-medium text-text-tertiary transition-colors hover:text-text-primary"
    >
      <ChevronLeft className="h-3 w-3" />
      <span className="truncate">{label}</span>
    </button>
  );
}

function EmptyHint({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 p-5 text-center">
      <p className="text-[0.8125rem] font-medium text-text-primary">{title}</p>
      <p className="mt-1 text-[0.7rem] text-text-tertiary">{body}</p>
    </div>
  );
}

function FloorBadge({
  code,
  selected,
}: {
  code: string;
  selected: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-[1.5rem] shrink-0 items-center justify-center rounded px-1 font-mono text-[0.65rem] font-medium tabular-nums",
        selected
          ? "bg-accent text-accent-contrast"
          : "bg-bg text-text-tertiary",
      )}
    >
      {code}
    </span>
  );
}

function floorCode(floor?: number): string {
  if (floor === undefined) return "—";
  if (floor === 0) return "G";
  return floor > 0 ? `${floor}F` : `${Math.abs(floor)}B`;
}

function ChevronLeft({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function WorkflowIcon({ className }: { className?: string }) {
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
      <circle cx="5" cy="6" r="2" />
      <circle cx="5" cy="18" r="2" />
      <path d="M5 8v8" />
      <path d="M9 6h10" />
      <path d="M9 18h10" />
      <path d="M19 8v8a4 4 0 0 1-4 4" />
    </svg>
  );
}

export const workflowView: View = {
  id: "workflow",
  label: "Workflow",
  icon: WorkflowIcon,
  entityTypes: "*",
  defaultDock: "left",
  component: WorkflowViewComponent,
};
