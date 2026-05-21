"use client";

import { useMemo, useState } from "react";
import type { FloorPlan, POI, Room } from "@klorad/api";
import type { Entity, ViewContext } from "@klorad/config/workbench";
import {
  ContextMenu,
  WorkflowDrillHeader,
  WorkflowListButton,
  WorkflowListItem,
  cn,
  useWorkflowDrill,
} from "@klorad/design-system";
import type { Building } from "../../entities/building";
import { EmptyHint } from "./shared";

/**
 * Workflow step 2 — buildings as a drill stack:
 *
 *   root      → list of buildings
 *   [b]       → that building's floors
 *   [b, f]    → that floor's rooms
 *
 * Selection mirrors the map; right-click surfaces the same
 * `ctx.operationsForEntity(...)` menu as elsewhere.
 *
 * Drill state lives in `useWorkflowDrill` from the DS — every
 * vertical that needs nested navigation uses the same hook.
 */
export function BuildingsStep({ ctx }: { ctx: ViewContext }) {
  const drill = useWorkflowDrill<string>();
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
  if (drill.depth === 0) {
    content = (
      <BuildingsList
        ctx={ctx}
        buildings={buildings}
        onDrill={drill.push}
        onContextMenu={openMenu}
      />
    );
  } else if (drill.depth === 1) {
    const buildingId = drill.path[0];
    const building = buildings.find((b) => b.id === buildingId);
    content = (
      <BuildingDetail
        ctx={ctx}
        buildingId={buildingId}
        buildingName={building?.payload.name ?? "Unnamed building"}
        onBack={drill.pop}
        onDrillFloor={drill.push}
        onContextMenu={openMenu}
      />
    );
  } else {
    const floorId = drill.path[1];
    content = (
      <FloorDetail
        ctx={ctx}
        floorId={floorId}
        onBack={drill.pop}
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
  ctx: ViewContext;
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
          .filter((f) => (f.payload as FloorPlan).buildingId === b.id).length;
        return (
          <WorkflowListItem key={b.id} selected={isSelected}>
            <button
              type="button"
              onClick={() =>
                ctx.setSelection({
                  ids: new Set([b.id]),
                  focusedId: b.id,
                })
              }
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
            <DrillChevron
              selected={isSelected}
              ariaLabel={`Open ${b.payload.name || "building"}`}
              onClick={() => onDrill(b.id)}
            />
          </WorkflowListItem>
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
  ctx: ViewContext;
  buildingId: string;
  buildingName: string;
  onBack: () => void;
  onDrillFloor: (floorId: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
}) {
  const floors = useMemo(
    () =>
      ctx.entities
        .byType("campus.floor-plan")
        .filter(
          (f) => (f.payload as FloorPlan).buildingId === buildingId,
        )
        .sort(
          (a, b) =>
            ((a.payload as FloorPlan).floor ?? 0) -
            ((b.payload as FloorPlan).floor ?? 0),
        ),
    [ctx.entities, buildingId],
  );

  return (
    <div className="space-y-3">
      <WorkflowDrillHeader label={buildingName} onBack={onBack} />
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
              <WorkflowListItem key={f.id} selected={isSelected}>
                <button
                  type="button"
                  onClick={() =>
                    ctx.setSelection({
                      ids: new Set([f.id]),
                      focusedId: f.id,
                    })
                  }
                  onContextMenu={(e) => onContextMenu(e, f.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 pr-2 text-left"
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
                <DrillChevron
                  selected={isSelected}
                  ariaLabel={`Open ${label}`}
                  onClick={() => onDrillFloor(f.id)}
                />
              </WorkflowListItem>
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
  ctx: ViewContext;
  floorId: string;
  onBack: () => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
}) {
  const floorEntity = ctx.entities.byId(floorId);
  const plan = floorEntity?.payload as FloorPlan | undefined;
  const rooms = useMemo(() => {
    if (!plan) return [];
    return ctx.entities
      .byType("campus.room")
      .filter(
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
      <WorkflowDrillHeader label={label} onBack={onBack} />
      {rooms.length === 0 ? (
        <EmptyHint
          title="No rooms yet"
          body="Use ⌘K → “Define room” to draw one inside this floor."
        />
      ) : (
        <div className="space-y-2">
          {rooms.map((r) => {
            const room = r.payload as Room;
            const isSelected = ctx.selection.focusedId === r.id;
            return (
              <WorkflowListButton
                key={r.id}
                selected={isSelected}
                onClick={() =>
                  ctx.setSelection({
                    ids: new Set([r.id]),
                    focusedId: r.id,
                  })
                }
                onContextMenu={(e) => onContextMenu(e, r.id)}
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
              </WorkflowListButton>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Local bits ──────────────────────────────────────────────────── */

function DrillChevron({
  selected,
  ariaLabel,
  onClick,
}: {
  selected?: boolean;
  ariaLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
        selected
          ? "text-accent hover:bg-accent/15"
          : "text-text-tertiary hover:bg-surface-2 hover:text-text-primary",
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
        aria-hidden
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
    </button>
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
          : "bg-surface-2 text-text-tertiary",
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

/* Local type narrowing — `byType("campus.poi")` returns `Entity[]`,
   campus knows it's `Entity<POI>[]`; not needed in this file but
   silences a stray unused-import warning the linter sometimes flags. */
export type _CampusPoi = POI;
