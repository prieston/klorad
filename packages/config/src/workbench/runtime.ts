import type { EntityIndex } from "./types";

/**
 * An `EntityIndex` with no entities. Useful as a default when a
 * Workbench mounts before its data backend is wired (or in tests).
 *
 * Subscribers are accepted but never invoked — the index never
 * changes.
 */
export const emptyEntityIndex: EntityIndex = {
  byId: () => undefined,
  byType: () => [],
  all: () => [],
  subscribe: () => () => {
    /* noop unsubscribe */
  },
};
