"use client";

import { useEffect, useRef, useState } from "react";
import {
  EntityInspector,
  WorkflowTabBar,
  type EntityInspectorAction,
} from "@klorad/design-system";
import type {
  Entity,
  ResolvedOperation,
  View,
  ViewProps,
} from "@klorad/config/workbench";

/**
 * The campus right-dock panel.
 *
 * One view, three tabs:
 *   - Inspect  — the selected element's properties + actions
 *   - Tools    — content-placement tools (Place POI)
 *   - Overview — campus-wide stats + accessibility coverage
 *
 * World-level actions (Save, Share, Open viewer) live in the
 * `WorkbenchTopBar`; scene-drawing tools (Draw building, Define room)
 * live in the on-canvas `SceneToolbar`. This panel is for everything
 * that's *about a selection* or *about the campus as a whole*.
 *
 * Selecting an element on the map auto-switches the panel to the
 * Inspect tab — the user's focus just moved, so the panel follows.
 */
type PanelTab = "inspector" | "tools" | "overview";

function CampusPanelComponent({ ctx }: ViewProps) {
  const [tab, setTab] = useState<PanelTab>("overview");
  const focusedId = ctx.selection.focusedId;

  // A new selection pulls the panel to the Inspect tab. Tracked via a
  // ref so re-selecting the same id (or clearing) doesn't fight a
  // user who has manually switched tabs.
  const prevFocused = useRef<string | null>(focusedId);
  useEffect(() => {
    if (focusedId && focusedId !== prevFocused.current) setTab("inspector");
    prevFocused.current = focusedId;
  }, [focusedId]);

  const tabs = [
    { id: "inspector", label: "Inspect", icon: InspectIcon },
    { id: "tools", label: "Tools", icon: ToolsIcon },
    { id: "overview", label: "Overview", icon: OverviewIcon },
  ];

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="pt-2">
        <WorkflowTabBar
          steps={tabs}
          current={tab}
          onChange={(id) => setTab(id as PanelTab)}
        />
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-4">
        {tab === "inspector" ? <InspectorTab ctx={ctx} /> : null}
        {tab === "tools" ? <ToolsTab ctx={ctx} /> : null}
        {tab === "overview" ? <OverviewTab ctx={ctx} /> : null}
      </div>
    </div>
  );
}

/* ─── Inspect tab ─────────────────────────────────────────────────── */

/**
 * Inspect tab — the selected element's editor + actions.
 *
 * Editing happens inline: the element's form-bearing operation (edit
 * building / floor / room / POI) is mounted directly here, and its
 * `submit` runs the operation with explicit args — skipping the
 * shell's modal entirely. The modal stays only as the ⌘K / right-
 * click fallback. Form-less operations (Fly to, Delete) become the
 * action buttons below the editor.
 */
function InspectorTab({ ctx }: { ctx: ViewProps["ctx"] }) {
  const focusedId = ctx.selection.focusedId;
  const entity = focusedId ? ctx.entities.byId(focusedId) : undefined;

  if (!focusedId || !entity) {
    return (
      <p className="pt-4 text-xs leading-relaxed text-text-tertiary">
        Click anything on the map or in the list to inspect and edit it.
      </p>
    );
  }

  const ops = ctx
    .operationsForEntity(focusedId)
    .filter((r) => r.operation.scope.length > 0);
  const editResolved = ops.find((r) => r.operation.Form);
  const actionResolved = ops.filter((r) => !r.operation.Form);
  const { typeLabel, icon, name } = describeEntity(entity);

  const actions: EntityInspectorAction[] = actionResolved.map((r) => ({
    id: r.operation.id,
    label: r.operation.label,
    icon: r.operation.icon,
    tone: r.operation.id.endsWith(".delete") ? "danger" : "default",
    onSelect: () => void ctx.runOperation(r.operation.id, undefined, r.on),
  }));

  return (
    <EntityInspector
      typeLabel={typeLabel}
      title={name}
      icon={icon}
      onClear={() =>
        ctx.setSelection({ ids: new Set<string>(), focusedId: null })
      }
      actions={actions}
    >
      {editResolved ? (
        <InlineOpForm key={focusedId} ctx={ctx} resolved={editResolved} />
      ) : null}
    </EntityInspector>
  );
}

/** Mounts an operation's `Form` inline and submits it without a modal. */
function InlineOpForm({
  ctx,
  resolved,
}: {
  ctx: ViewProps["ctx"];
  resolved: ResolvedOperation;
}) {
  const { operation, on } = resolved;
  const Form = operation.Form;
  if (!Form) return null;
  const initialArgs = operation.initialArgs?.(
    { worldId: ctx.worldId, entities: ctx.entities },
    on,
  );
  return (
    <Form
      initialArgs={initialArgs}
      submit={(args) => void ctx.runOperation(operation.id, args, on)}
      cancel={() =>
        ctx.setSelection({ ids: new Set<string>(), focusedId: null })
      }
    />
  );
}

/** Resolve an entity to a human type label, glyph and display name. */
function describeEntity(entity: Entity): {
  typeLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  name: string;
} {
  const payload = entity.payload as {
    name?: string;
    linkedBuilding?: unknown;
    floor?: number;
  };
  switch (entity.typeId) {
    case "campus.poi":
      return payload.linkedBuilding
        ? {
            typeLabel: "Building",
            icon: BuildingGlyph,
            name: payload.name || "Unnamed building",
          }
        : {
            typeLabel: "POI",
            icon: PoiGlyph,
            name: payload.name || "Unnamed POI",
          };
    case "campus.building":
      return {
        typeLabel: "Building",
        icon: BuildingGlyph,
        name: payload.name || "Unnamed building",
      };
    case "campus.floor-plan":
      return {
        typeLabel: "Floor",
        icon: FloorGlyph,
        name:
          payload.name ||
          (typeof payload.floor === "number"
            ? `Floor ${payload.floor}`
            : "Floor"),
      };
    case "campus.room":
      return {
        typeLabel: "Room",
        icon: RoomGlyph,
        name: payload.name || "Unnamed room",
      };
    default:
      return {
        typeLabel: entity.typeId.replace("campus.", ""),
        icon: InspectIcon,
        name: payload.name || entity.id,
      };
  }
}

/* ─── Tools tab ───────────────────────────────────────────────────── */

function ToolsTab({ ctx }: { ctx: ViewProps["ctx"] }) {
  return (
    <div className="space-y-3 pt-3">
      <p className="text-xs leading-relaxed text-text-secondary">
        Tools add new content to your campus. Pick one, then click on
        the map to place it.
      </p>
      <ToolTile
        icon={PlusIcon}
        label="Place POI"
        description="Drop a point of interest — entrance, café, department, accessibility note."
        onClick={() => void ctx.runOperation("poi.place", undefined, [])}
      />
    </div>
  );
}

function ToolTile({
  icon: Icon,
  label,
  description,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-start gap-3 rounded-2xl border border-line-soft bg-bg p-3 text-left transition-colors hover:border-accent hover:bg-accent-soft"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent transition-colors group-hover:bg-accent group-hover:text-accent-contrast">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-text-primary">
          {label}
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-text-secondary">
          {description}
        </span>
      </span>
    </button>
  );
}

/* ─── Overview tab ────────────────────────────────────────────────── */

function OverviewTab({ ctx }: { ctx: ViewProps["ctx"] }) {
  const pois = ctx.entities.byType("campus.poi");
  const buildings = ctx.entities.byType("campus.building");
  const floorPlans = ctx.entities.byType("campus.floor-plan");
  const events = ctx.entities.byType("campus.event");

  const accessibleCount = pois.filter((p) => {
    const payload = p.payload as {
      accessibility?: { wheelchairAccessible?: boolean };
    };
    return payload?.accessibility?.wheelchairAccessible;
  }).length;
  const accessibilityPct =
    pois.length > 0 ? Math.round((accessibleCount / pois.length) * 100) : 0;

  const shortWorldId =
    ctx.worldId.length > 12
      ? `${ctx.worldId.slice(0, 6)}…${ctx.worldId.slice(-4)}`
      : ctx.worldId;

  return (
    <div className="space-y-4 pt-3">
      <p
        className="truncate font-mono text-[0.7rem] text-text-tertiary"
        title={ctx.worldId}
      >
        {shortWorldId}
      </p>

      {/* Hairline-grid stats — bg-bg cells visible against the white
          dock, gap-px hairlines between them. */}
      <div className="grid w-full grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line-soft bg-line-soft">
        <StatCell label="POIs" value={pois.length} />
        <StatCell label="Buildings" value={buildings.length} />
        <StatCell label="Floor plans" value={floorPlans.length} />
        <StatCell label="Events" value={events.length} />
      </div>

      <Card title="Accessibility coverage">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-light tabular-nums leading-none text-text-primary">
            {accessibilityPct}%
          </span>
          <span className="truncate text-xs text-text-secondary">
            {accessibleCount} / {pois.length} POIs
          </span>
        </div>
      </Card>
    </div>
  );
}

/** One stat cell — large number over a small caps label. */
function StatCell({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="min-w-0 overflow-hidden bg-bg p-4">
      <div className="truncate text-[0.65rem] font-medium uppercase tracking-[0.14em] text-text-tertiary">
        {label}
      </div>
      <div className="mt-1.5 truncate text-xl font-light tabular-nums leading-none text-text-primary">
        {value}
      </div>
    </div>
  );
}

/** Light-bg card — `bg-bg` reads as a tile on the dock's `surface-1`. */
function Card({
  title,
  children,
}: {
  title?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line-soft bg-bg p-4">
      {title ? (
        <h3 className="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
          {title}
        </h3>
      ) : null}
      {children}
    </section>
  );
}

/* ─── Icons ───────────────────────────────────────────────────────── */

function InspectIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function ToolsIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4l-6 6 3 3 6-6a4 4 0 0 0 5.4-5.4l-2.6 2.6-2-2 2.2-3.2Z" />
    </svg>
  );
}

function OverviewIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function BuildingGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <path d="M9 7h.01M15 7h.01M9 12h.01M15 12h.01" />
      <path d="M9 17h6" />
    </svg>
  );
}

function FloorGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M3 7l9-4 9 4-9 4-9-4Z" />
      <path d="M3 13l9 4 9-4" />
    </svg>
  );
}

function RoomGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="1.5" />
      <path d="M3 14h7v7" />
    </svg>
  );
}

function PoiGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 21s-7-6.5-7-12a7 7 0 1 1 14 0c0 5.5-7 12-7 12Z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export const campusPanelView: View = {
  id: "panel",
  label: "Panel",
  icon: OverviewIcon,
  entityTypes: "*",
  defaultDock: "right",
  component: CampusPanelComponent,
};
