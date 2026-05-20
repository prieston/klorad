/**
 * The Workbench type contracts and `defineWorkbench` factory.
 *
 * Import from `@klorad/config/workbench`:
 *
 * ```ts
 * import {
 *   defineWorkbench,
 *   type EntityType,
 *   type View,
 *   type Operation,
 * } from "@klorad/config/workbench";
 * ```
 *
 * See `apps/campus/WORKBENCH.md` for the architectural rationale.
 */

export * from "./types";
export { defineWorkbench } from "./define";
