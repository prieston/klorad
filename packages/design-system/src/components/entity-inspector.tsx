"use client";

import type { ComponentType, ReactNode } from "react";
import { cn } from "../utils/cn";

/**
 * A button shown in the inspector's action row — Fly to, Delete,
 * Duplicate, etc. Distinct from the inline editor (`children`): an
 * action fires immediately, an editor gathers a change.
 */
export interface EntityInspectorAction {
  id: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  onSelect: () => void;
  /** `danger` tints the button red for destructive actions. */
  tone?: "default" | "danger";
}

export interface EntityInspectorProps {
  /** Entity-type label — "Building", "Room", "POI". Shown small-caps. */
  typeLabel: string;
  /** Entity display name. */
  title: string;
  /** Small icon for the entity type. */
  icon?: ComponentType<{ className?: string }>;
  /** Clears the selection. */
  onClear?: () => void;
  /** Action buttons rendered below the editor. */
  actions?: EntityInspectorAction[];
  /** The inline editor — typically an operation's form, mounted live. */
  children?: ReactNode;
  className?: string;
}

/**
 * The inspector for a single selected entity: a type/name header, an
 * inline editor, and an action row. Editing happens *in place* — no
 * modal — which is the whole point of the primitive.
 *
 * Vertical-agnostic. Campus inspects buildings / floors / rooms /
 * POIs; Mobility inspects stops and lines; Heritage inspects sites.
 * The host passes whatever editor and actions it likes.
 */
export function EntityInspector({
  typeLabel,
  title,
  icon: Icon,
  onClear,
  actions,
  children,
  className,
}: EntityInspectorProps) {
  return (
    <div className={cn("flex flex-col gap-4 pt-3", className)}>
      <header className="flex items-start gap-3">
        {Icon ? (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="text-[0.6rem] font-medium uppercase tracking-[0.14em] text-text-tertiary">
            {typeLabel}
          </div>
          <div
            className="truncate text-sm font-semibold text-text-primary"
            title={title}
          >
            {title}
          </div>
        </div>
        {onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 text-[0.7rem] font-medium text-text-secondary transition-colors hover:text-accent"
          >
            Clear
          </button>
        ) : null}
      </header>

      {children ? <div>{children}</div> : null}

      {actions && actions.length > 0 ? (
        <div className="flex flex-col gap-1.5 border-t border-line-soft pt-3">
          {actions.map((action) => {
            const ActionIcon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                onClick={action.onSelect}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
                  action.tone === "danger"
                    ? "border-line-soft text-red-600 hover:border-red-500/40 hover:bg-red-500/10 dark:text-red-400"
                    : "border-line-soft text-text-secondary hover:border-accent hover:bg-accent-soft hover:text-accent",
                )}
              >
                {ActionIcon ? (
                  <ActionIcon className="h-3.5 w-3.5 shrink-0" />
                ) : null}
                {action.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
