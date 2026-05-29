/**
 * Deterministic gradient + label colour for a campus card banner.
 *
 * The IHU mocks show every campus card topped with a coloured gradient
 * banner — teal / green / purple / orange / pink / etc. — used as a
 * visual handle so rectors can tell campuses apart at a glance.
 * Picking the hue from a hash of the campus id means the same campus
 * always gets the same colour across the dashboard (Org Overview's
 * "Most active" cards, the Campuses grid, the campus picker) without
 * us having to store one in the schema.
 */

const HUES = [200, 160, 270, 25, 320, 100, 50, 240];

/** Hash a string to a stable non-negative integer. djb2 — fast enough. */
function hashString(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Two-stop diagonal gradient suitable for a CSS `background` value.
 * Picks one of `HUES` based on the campus id, then renders a darker
 * lower-right and lighter upper-left to give the banner the same
 * depth as the design mocks.
 */
export function bannerGradient(campusId: string): string {
  const hue = HUES[hashString(campusId) % HUES.length];
  const start = `hsl(${hue}, 55%, 45%)`;
  const end = `hsl(${hue}, 60%, 30%)`;
  return `linear-gradient(135deg, ${start} 0%, ${end} 100%)`;
}

/**
 * A dot-grid pattern overlay drawn on top of the gradient — matches
 * the texture in the mocks. Returns a CSS `background-image` value
 * stacked over the gradient; the caller composes them.
 */
export function bannerOverlay(): string {
  return "radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px)";
}
