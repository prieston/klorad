/**
 * Saved routes — rector-defined named walking tours through the
 * campus's MappedIn spaces. Surfaced as chips on the public map
 * (`Library → Main Cafeteria`, `Accessible route to the Gym`, etc.);
 * tapping a chip fires the existing from→to wayfinding pipeline.
 *
 * Persisted under `Project.sceneData.savedRoutes`. Same merge
 * pattern as `defaultLocale` and `klio` config.
 *
 * MVP scope: two stops per route (origin + destination), plus an
 * accessible-routing flag. The MappedIn viewer's `route(from, to)`
 * doesn't natively chain multi-stop tours, so a real waypoint
 * route would draw N segments one after another — a separate arc.
 */

export type Locale = "en" | "el";

/** A single stop. References a MappedIn space the rector picked via
 *  the existing `AnchorPicker`. `refId` is the MappedIn space id;
 *  `refName` is the human label cached at authoring time so the chip
 *  reads correctly even when MappedIn's API is slow. */
export interface SavedRouteStop {
  refId: string;
  refName: string;
}

export interface SavedRoute {
  /** Stable id — set once on creation, never reused. Used as the
   *  React key and the chip's data-route-id attribute. */
  id: string;
  /** EN name — required. Falls back to the chip label when EL is
   *  unset. Capped at 60 chars to keep the chip pill-sized. */
  name: string;
  /** EL name — optional. */
  nameEl?: string;
  /** Origin space. */
  from: SavedRouteStop;
  /** Destination space. */
  to: SavedRouteStop;
  /** Draw the step-free variant when true. */
  accessible: boolean;
}

/** Hard cap so a buggy rector can't ship a 200-chip strip that
 *  scrolls forever on the public map. */
export const MAX_SAVED_ROUTES = 8;

/** Narrow `sceneData.savedRoutes` (Prisma `Json`) into a validated
 *  `SavedRoute[]`. Anything malformed is silently filtered — better
 *  to lose one row than to crash the dashboard. */
export function parseSavedRoutes(value: unknown): SavedRoute[] {
  if (!Array.isArray(value)) return [];
  const out: SavedRoute[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const id = typeof e.id === "string" ? e.id : "";
    const name = typeof e.name === "string" ? e.name.trim() : "";
    const from = parseStop(e.from);
    const to = parseStop(e.to);
    if (!id || !name || !from || !to) continue;
    const nameEl =
      typeof e.nameEl === "string" && e.nameEl.trim().length > 0
        ? e.nameEl.trim().slice(0, 60)
        : undefined;
    out.push({
      id,
      name: name.slice(0, 60),
      nameEl,
      from,
      to,
      accessible: e.accessible === true,
    });
  }
  return out.slice(0, MAX_SAVED_ROUTES);
}

function parseStop(value: unknown): SavedRouteStop | null {
  if (!value || typeof value !== "object") return null;
  const e = value as Record<string, unknown>;
  const refId = typeof e.refId === "string" ? e.refId.trim() : "";
  const refName = typeof e.refName === "string" ? e.refName.trim() : "";
  if (!refId || !refName) return null;
  return { refId, refName: refName.slice(0, 80) };
}

/** Pick the right locale's label for a chip. Falls back to EN. */
export function routeLabel(route: SavedRoute, locale: Locale): string {
  if (locale === "el" && route.nameEl?.trim()) return route.nameEl;
  return route.name;
}
