/**
 * Shared world-theme derivation. Two operator picks (background +
 * primary) → a full set of `--w-*` CSS custom properties every
 * mobility visitor surface consumes. Kept in one place so the map,
 * devices list, notifications feed, and Paris panel stay in sync
 * on a theme change instead of drifting per-file.
 *
 * The returned record is meant to be spread into a `style={{ ... }}`
 * on the wrapping element (`<body>`, `<main>`, or the layout's root
 * div). Everything downstream reads via `var(--w-*)`.
 */

const DEFAULT_PRIMARY = "#0ea5e9";
const DEFAULT_BG = "#0b1220";

export function worldPickHex(value: unknown, fallback: string): string {
  if (typeof value === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) {
    return value;
  }
  return fallback;
}

/** Expand `#rgb` → `#rrggbb` so the channel reads below stay uniform. */
function expandHex(hex: string): string {
  if (hex.length === 7) return hex;
  const body = hex.slice(1);
  return `#${body[0]}${body[0]}${body[1]}${body[1]}${body[2]}${body[2]}`;
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

function hexToRgb(hex: string): RGB {
  const h = expandHex(hex).slice(1);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgba({ r, g, b }: RGB, a: number): string {
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Perceived brightness — drives the fg/border choice so the operator
 *  can paint a world bright or dark and the chrome reads either way. */
function isLight({ r, g, b }: RGB): boolean {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55;
}

/**
 * Every `--w-*` variable a mobility surface can read:
 *
 *   --w-bg              body / canvas background (operator's pick)
 *   --w-page            alias for --w-bg — surface behind cards
 *   --w-surface         elevated card surface (white on light themes,
 *                       ~8% lifted from bg on dark themes)
 *   --w-fg              primary text
 *   --w-fg-soft         secondary text
 *   --w-fg-muted        tertiary / helper text
 *   --w-border          hairline dividers + card borders
 *   --w-border-strong   input outlines + tabbable borders
 *   --w-overlay         tinted background for hover / subtle fills
 *   --w-accent          brand primary (operator's second pick)
 *   --w-accent-soft     accent-tinted background for chips + pills
 *   --w-accent-contrast readable text on top of `--w-accent`
 */
export function deriveWorldPalette(
  bgHex: string,
  primaryHex: string,
): Record<string, string> {
  const bgRgb = hexToRgb(bgHex);
  const primaryRgb = hexToRgb(primaryHex);
  const light = isLight(bgRgb);
  const fgBase: RGB = light
    ? { r: 11, g: 18, b: 32 }
    : { r: 245, g: 247, b: 250 };
  const accentContrast: RGB = isLight(primaryRgb)
    ? { r: 11, g: 18, b: 32 }
    : { r: 255, g: 255, b: 255 };
  // Elevated surface: on light themes, plain white for card contrast;
  // on dark themes, blend the fg into the bg at ~8% so cards read as
  // slightly lifted without going full white and blowing out contrast.
  const surface = light
    ? "#ffffff"
    : `color-mix(in srgb, ${bgHex} 92%, ${rgba(fgBase, 1)} 8%)`;
  return {
    "--w-bg": bgHex,
    "--w-page": bgHex,
    "--w-surface": surface,
    "--w-fg": rgba(fgBase, 0.95),
    "--w-fg-soft": rgba(fgBase, 0.72),
    "--w-fg-muted": rgba(fgBase, 0.5),
    "--w-border": rgba(fgBase, light ? 0.14 : 0.16),
    "--w-border-strong": rgba(fgBase, light ? 0.22 : 0.28),
    "--w-overlay": rgba(fgBase, light ? 0.06 : 0.08),
    "--w-accent": primaryHex,
    "--w-accent-soft": rgba(primaryRgb, 0.18),
    "--w-accent-contrast": rgba(accentContrast, 1),
  };
}

/** Two-arg version for callers that only have raw theme values. */
export function deriveWorldPaletteFromTheme(
  theme: Record<string, unknown> | undefined | null,
): Record<string, string> {
  const bg = worldPickHex(theme?.backgroundColor, DEFAULT_BG);
  const primary = worldPickHex(theme?.primaryColor, DEFAULT_PRIMARY);
  return deriveWorldPalette(bg, primary);
}
