"use client";

import type { ComponentType } from "react";
import { cn } from "../utils/cn";

/**
 * A single scene tool — a drawing / placement action that operates
 * directly on the 3D canvas (draw a building, define a room, drop a
 * marker). Distinct from world actions (Save, Share) and entity
 * actions (Edit, Delete): a scene tool arms a mode the user then
 * performs *on the map*.
 */
export interface SceneTool {
  id: string;
  /** Human label — shown as a hover flyout and used for `aria-label`. */
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Arm the tool. */
  onSelect: () => void;
  /** Greyed out + non-interactive when true. */
  disabled?: boolean;
  /** Highlighted when the tool's mode is currently armed. */
  active?: boolean;
  /**
   * Replacement flyout text when `disabled` — e.g. "Select a floor
   * first". Falls back to `label`.
   */
  hint?: string;
}

export interface SceneToolbarProps {
  tools: SceneTool[];
  /** Bar axis. Defaults to vertical (design-tool convention). */
  orientation?: "vertical" | "horizontal";
  className?: string;
}

/**
 * A floating toolbar that overlays the 3D scene with drawing /
 * placement tools. Glass pill, icon buttons, hover label flyouts —
 * the Klorad visual language.
 *
 * Vertical-agnostic: campus arms "Draw building" / "Define room",
 * but Mobility (draw a route), Heritage (place a waypoint) and Urban
 * reuse the same primitive — they just pass different `tools`.
 *
 * Mount it inside a `relative` canvas container and position with
 * `className` (e.g. `absolute left-4 top-4 z-10`).
 */
export function SceneToolbar({
  tools,
  orientation = "vertical",
  className,
}: SceneToolbarProps) {
  if (tools.length === 0) return null;
  return (
    <div
      role="toolbar"
      aria-orientation={orientation}
      className={cn(
        "flex gap-1 rounded-2xl border border-line-soft bg-surface-1/95 p-1.5 shadow-glass backdrop-blur",
        orientation === "vertical" ? "flex-col" : "flex-row",
        className,
      )}
    >
      {tools.map((tool) => (
        <SceneToolButton key={tool.id} tool={tool} orientation={orientation} />
      ))}
    </div>
  );
}

function SceneToolButton({
  tool,
  orientation,
}: {
  tool: SceneTool;
  orientation: "vertical" | "horizontal";
}) {
  const Icon = tool.icon;
  const flyout = tool.disabled && tool.hint ? tool.hint : tool.label;
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={tool.onSelect}
        disabled={tool.disabled}
        aria-label={tool.label}
        aria-pressed={tool.active}
        className={cn(
          "grid h-9 w-9 place-items-center rounded-xl transition-colors",
          tool.active
            ? "bg-accent text-accent-contrast"
            : tool.disabled
              ? "cursor-not-allowed text-text-tertiary"
              : "text-text-secondary hover:bg-accent-soft hover:text-accent",
        )}
      >
        <Icon className="h-4 w-4" />
      </button>
      <span
        className={cn(
          "pointer-events-none absolute z-20 whitespace-nowrap rounded-lg border border-line-soft bg-surface-1 px-2 py-1 text-xs text-text-primary opacity-0 shadow-glass transition-opacity group-hover:opacity-100",
          orientation === "vertical"
            ? "left-full top-1/2 ml-2 -translate-y-1/2"
            : "left-1/2 top-full mt-2 -translate-x-1/2",
        )}
      >
        {flyout}
      </span>
    </div>
  );
}
