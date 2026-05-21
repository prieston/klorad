"use client";

import { useMemo, useState } from "react";
import type {
  Actor,
  DockRegion,
  EntityIndex,
  OpResult,
  SelectionState,
  ToastTone,
  ViewContext,
  WorkbenchConfig,
} from "@klorad/config/workbench";
import { emptyEntityIndex } from "@klorad/config/workbench";
import { Dock } from "./dock";

export type WorkbenchToast = (msg: string, tone?: ToastTone) => void;

export type WorkbenchProps = {
  /** The vertical's config, produced by `defineWorkbench(...)`. */
  config: WorkbenchConfig;
  /** The world being edited (typically the map id in campus). */
  worldId: string;
  /** Who's running the show. Defaults to an anonymous user. */
  actor?: Actor;
  /** Custom entity backend. Defaults to an empty in-memory index. */
  entities?: EntityIndex;
  /**
   * Surface for operation toasts. Operations call `ctx.toast(msg, tone)`
   * from inside `invoke`; whatever surface the app uses (react-toastify,
   * sonner, etc.) plugs in here. Defaults to a noop — operations stay
   * functional, but their feedback is silent.
   */
  toast?: WorkbenchToast;
};

const defaultActor: Actor = { kind: "user", userId: "anonymous" };
const noopToast: WorkbenchToast = () => {
  /* deliberate noop default */
};

/**
 * The Workbench shell — Phase 2 v1.
 *
 * Reads a `WorkbenchConfig`, resolves views from the config's default
 * layout, and mounts each view into its dock region with a shared
 * `ViewContext`. Selection state lives in the shell; operation
 * invocation looks up the op by id and dispatches.
 *
 * Out of scope for v1 (each is its own phase per WORKBENCH.md):
 * - Free-rearrange layout, drag-to-resize handles, layout persistence
 * - Pre-computed `applicableOperations` per selection
 * - Command palette (`mod+k`), right-click menu, keyboard shortcuts
 * - AI suggestion stream / approval gating
 */
export function Workbench({
  config,
  worldId,
  actor = defaultActor,
  entities = emptyEntityIndex,
  toast = noopToast,
}: WorkbenchProps) {
  const [selection, setSelection] = useState<SelectionState>(() => ({
    ids: new Set<string>(),
    focusedId: null,
  }));

  const viewById = useMemo(
    () => new Map(config.views.map((v) => [v.id, v])),
    [config.views],
  );

  const operationById = useMemo(
    () => new Map(config.operations.map((o) => [o.id, o])),
    [config.operations],
  );

  const ctx = useMemo<ViewContext>(
    () => ({
      worldId,
      selection,
      setSelection,
      entities,
      runOperation: async (opId, args, on): Promise<OpResult> => {
        const op = operationById.get(opId);
        if (!op) {
          return { ok: false, reason: `Unknown operation: ${opId}` };
        }
        return op.invoke(
          { worldId, actor, entities, toast },
          args as never,
          on,
        );
      },
      // Computed in a later phase once we wire `applies` per selection.
      applicableOperations: [],
    }),
    [worldId, selection, entities, actor, operationById, toast],
  );

  const renderRegion = (region: DockRegion) => {
    const ids = config.defaultLayout[region];
    if (ids.length === 0) return null;
    return (
      <div className="flex h-full flex-col">
        {ids.map((id) => {
          const view = viewById.get(id);
          // Each view is wrapped in `flex-1 min-h-0` so multiple views
          // stacked in the same region split the available height evenly
          // instead of fighting over `h-full`. A divider between siblings
          // (except the last) gives them visual separation.
          if (!view) {
            return (
              <div
                key={id}
                className="m-3 rounded-md border border-dashed border-line-strong p-3 text-xs text-text-tertiary"
              >
                Missing view: <code className="font-mono">{id}</code>
              </div>
            );
          }
          const Component = view.component;
          return (
            <div
              key={id}
              className="min-h-0 flex-1 overflow-hidden border-b border-line-soft last:border-b-0"
            >
              <Component ctx={ctx} />
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Dock
      left={renderRegion("left")}
      center={renderRegion("center") ?? <EmptyCenter />}
      right={renderRegion("right")}
      bottom={renderRegion("bottom")}
    />
  );
}

function EmptyCenter() {
  return (
    <div className="flex h-full items-center justify-center p-8 text-center text-sm text-text-tertiary">
      No views configured for the center region.
    </div>
  );
}
