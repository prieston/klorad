/**
 * Floor-plan editor data model.
 *
 * The editor works in a local metric coordinate system — metres,
 * origin top-left, y increasing downward (a plan view; absolute
 * orientation is georeferenced later). Phase 1 covers walls only;
 * openings and furniture arrive in later phases.
 */

/** A point in floor-plan space — metres. */
export interface Pt {
  x: number;
  y: number;
}

/** A straight wall segment. */
export interface Wall {
  id: string;
  start: Pt;
  end: Pt;
  /** Wall thickness, metres. */
  thickness: number;
}

/** Default wall thickness (metres) for newly drawn walls. */
export const DEFAULT_WALL_THICKNESS = 0.15;
