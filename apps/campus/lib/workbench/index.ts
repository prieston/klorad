/**
 * The campus Workbench module — campus's typed entities, operations,
 * and views that the shared Workbench shell will consume.
 *
 * Phase 1.2 — entity registrations only. Views land in Phase 3 (after
 * the shell), operations in Phase 5 (after views). See
 * `apps/campus/WORKBENCH.md` for the full migration plan.
 *
 * No runtime behaviour change yet: nothing in the builder reads these
 * registrations. They sit alongside the existing code paths, ready
 * for the shell.
 */

export * from "./entities";
export { identitySchema } from "./schema";
