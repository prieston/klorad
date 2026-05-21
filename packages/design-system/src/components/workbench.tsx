"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  Actor,
  DockRegion,
  EntityIndex,
  OpResult,
  Operation,
  ResolvedOperation,
  SelectionState,
  ToastTone,
  ViewContext,
  WorkbenchConfig,
} from "@klorad/config/workbench";
import { emptyEntityIndex } from "@klorad/config/workbench";
import { CommandPalette } from "./command-palette";
import { Dock } from "./dock";
import { Modal } from "./modal";

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
 * The Workbench shell.
 *
 * Reads a `WorkbenchConfig`, resolves views from the config's default
 * layout, and mounts each view into its dock region with a shared
 * `ViewContext`. Selection state lives in the shell; operation
 * invocation looks up the op by id and dispatches.
 *
 * Shipped:
 * - Phase 2  — config-driven dock + views
 * - Phase 5b — `ctx.toast` plumbed to the host app
 * - Phase 5c1 — `applicableOperations` computed per render
 * - Phase 5c2 — command palette (`mod+k`) over `applicableOperations`
 *
 * Still queued (own phase each):
 * - Right-click menu (5c3), AI suggestion stream + approval gating (7),
 *   layout persistence + drag-to-rearrange.
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
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Phase 5d-b — Form modal state. When an op with a `Form` is invoked
  // without explicit args, the shell opens its Form here, awaits the
  // user, then runs `invoke(args)` once the form submits. `resolve`
  // is the deferred promise from the `runOperation` call that
  // triggered the form — fulfilled on submit or cancel.
  const [activeForm, setActiveForm] = useState<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    op: Operation<any>;
    on: string[];
    initialArgs: unknown;
    resolve: (result: OpResult) => void;
  } | null>(null);

  // `mod+k` toggles the command palette globally. Accept both Cmd
  // (macOS) and Ctrl (everywhere else) so the binding feels native
  // on either platform. `e.preventDefault()` is load-bearing: every
  // major browser hijacks Cmd/Ctrl+K to focus the address bar.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() !== "k") return;
      e.preventDefault();
      setPaletteOpen((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const viewById = useMemo(
    () => new Map(config.views.map((v) => [v.id, v])),
    [config.views],
  );

  const operationById = useMemo(
    () => new Map(config.operations.map((o) => [o.id, o])),
    [config.operations],
  );

  // Phase 5c1 — generic operation surfacing.
  //
  // For each registered op: ask its `applies` predicate against the
  // current selection. If true, resolve the `on` list:
  //   - world-level ops (`scope: []`) bind to no entities (`on = []`)
  //   - entity-scoped ops bind to selected ids whose typeId falls in scope
  //
  // Views render this list generically instead of hardcoding per-op
  // buttons. The command palette and right-click menu pull from the
  // same list in 5c2 / 5c3.
  const applicableOperations = useMemo<ResolvedOperation[]>(() => {
    const selectedIds = [...selection.ids];
    const resolved: ResolvedOperation[] = [];
    for (const op of config.operations) {
      if (!op.applies(selection, entities)) continue;
      const on =
        op.scope.length === 0
          ? []
          : selectedIds.filter((id) => {
              const entity = entities.byId(id);
              return entity ? op.scope.includes(entity.typeId) : false;
            });
      resolved.push({ operation: op, on });
    }
    return resolved;
  }, [config.operations, selection, entities]);

  const runOperation = useCallback(
    async <A,>(
      opId: string,
      args: A,
      on: string[],
    ): Promise<OpResult> => {
      const op = operationById.get(opId);
      if (!op) {
        return { ok: false, reason: `Unknown operation: ${opId}` };
      }
      // Phase 5d-b — if the op declares a Form and the caller didn't
      // pass explicit args, gather them via a Modal first. The Modal
      // submits with the Args; cancellation resolves with `ok: false`.
      // Callers that already have args (programmatic / AI / replay)
      // skip the form entirely by passing a non-`undefined` value.
      if (op.Form && args === undefined) {
        return new Promise<OpResult>((resolve) => {
          const initial = op.initialArgs
            ? op.initialArgs({ worldId, entities }, on)
            : undefined;
          setActiveForm({
            op,
            on,
            initialArgs: initial,
            resolve,
          });
        });
      }
      return op.invoke(
        { worldId, actor, entities, toast },
        args as never,
        on,
      );
    },
    [operationById, worldId, actor, entities, toast],
  );

  // Form-modal lifecycle. `runForm` is called from inside the Modal
  // when the Form submits; it invokes the op with the gathered args
  // and resolves the deferred promise from `runOperation`. `closeForm`
  // is the cancel path — resolves with a `Cancelled` failure so the
  // caller can distinguish "user backed out" from "op failed".
  const runForm = useCallback(
    async (args: unknown) => {
      if (!activeForm) return;
      const result = await activeForm.op.invoke(
        { worldId, actor, entities, toast },
        args as never,
        activeForm.on,
      );
      activeForm.resolve(result);
      setActiveForm(null);
    },
    [activeForm, worldId, actor, entities, toast],
  );

  const closeForm = useCallback(() => {
    if (!activeForm) return;
    activeForm.resolve({ ok: false, reason: "Cancelled" });
    setActiveForm(null);
  }, [activeForm]);

  // Phase 5c3 — operations applicable to one specific entity,
  // independent of the current selection. The right-click menu uses
  // this so the menu reflects what the user right-clicked, not
  // what's selected. Builds a hypothetical single-entity selection
  // and runs each op's `applies` predicate against it.
  const operationsForEntity = useCallback(
    (entityId: string): ResolvedOperation[] => {
      const entity = entities.byId(entityId);
      if (!entity) return [];
      const hypothetical: SelectionState = {
        ids: new Set([entityId]),
        focusedId: entityId,
      };
      const resolved: ResolvedOperation[] = [];
      for (const op of config.operations) {
        // Skip entity-scoped ops whose scope doesn't include this type.
        if (op.scope.length > 0 && !op.scope.includes(entity.typeId)) {
          continue;
        }
        if (!op.applies(hypothetical, entities)) continue;
        // World-level ops still get `on: []`; entity-scoped get `[id]`.
        resolved.push({
          operation: op,
          on: op.scope.length === 0 ? [] : [entityId],
        });
      }
      return resolved;
    },
    [config.operations, entities],
  );

  const ctx = useMemo<ViewContext>(
    () => ({
      worldId,
      selection,
      setSelection,
      entities,
      runOperation,
      applicableOperations,
      operationsForEntity,
    }),
    [
      worldId,
      selection,
      entities,
      runOperation,
      applicableOperations,
      operationsForEntity,
    ],
  );

  // Invoked by the command palette when the user picks a row. Fires
  // the operation through the same dispatch as view-authored buttons.
  const handlePaletteRun = useCallback(
    (resolved: ResolvedOperation) => {
      void runOperation(resolved.operation.id, undefined, resolved.on);
    },
    [runOperation],
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
    <>
      <Dock
        left={renderRegion("left")}
        center={renderRegion("center") ?? <EmptyCenter />}
        right={renderRegion("right")}
        bottom={renderRegion("bottom")}
      />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        operations={applicableOperations}
        onRun={handlePaletteRun}
      />
      {activeForm && activeForm.op.Form ? (
        <Modal
          open
          onClose={closeForm}
          title={activeForm.op.label}
          className="max-w-lg"
        >
          {(() => {
            // Local alias so the JSX expression below sees a non-
            // optional component type. The earlier guard ensures Form
            // exists; TS just can't track it through a deep property.
            const Form = activeForm.op
              .Form as React.ComponentType<{
              initialArgs?: unknown;
              submit(args: unknown): void;
              cancel(): void;
            }>;
            return (
              <Form
                initialArgs={activeForm.initialArgs}
                submit={(args: unknown) => void runForm(args)}
                cancel={closeForm}
              />
            );
          })()}
        </Modal>
      ) : null}
    </>
  );
}

function EmptyCenter() {
  return (
    <div className="flex h-full items-center justify-center p-8 text-center text-sm text-text-tertiary">
      No views configured for the center region.
    </div>
  );
}
