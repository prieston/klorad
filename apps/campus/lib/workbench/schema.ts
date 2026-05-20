import type { EntitySchema } from "@klorad/config/workbench";

/**
 * A no-op `EntitySchema` — `parse` is identity, `safeParse` always
 * succeeds. The Phase 1 entity registrations declare the typed surface
 * without yet running runtime validation; when the Workbench shell
 * starts loading entities from the server (Phase 2+) these get swapped
 * for real zod schemas (or equivalent).
 */
export function identitySchema<T>(): EntitySchema<T> {
  return {
    parse: (value) => value as T,
    safeParse: (value) => ({ success: true, data: value as T }),
  };
}
