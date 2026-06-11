/**
 * Brand palette generator — shared platform utility.
 *
 * Takes a single hex (the tenant's "primary colour" from settings)
 * and derives a coordinated set of brand tokens using OKLCH, the
 * perceptually uniform colour space. Every shift (lighten / darken /
 * hue-rotate) keeps the same visual weight whether the input is deep
 * blue, muddy olive, or vivid coral. Hand-rolled HSL math would muddy
 * some primaries; OKLCH stays balanced.
 *
 * Outputs primary + light/dark variants for the brand colour and
 * three hue-rotated accents (warm +30°, cool -30°, complement +180°)
 * so themed surfaces (news banners, alert chips, route highlights)
 * get coordinated secondaries that harmonise with whatever primary
 * the rector / operator picks.
 *
 * Domain-agnostic: every Klorad vertical (Campus, Mobility, etc.)
 * reuses the same eight tokens by writing them as `--brand-*` CSS
 * custom properties on the wrapper. Sub-exported so consumers that
 * don't theme can keep `culori` out of their bundle.
 */
import type { CSSProperties } from "react";
import { converter, formatHex, parse } from "culori";

const toOklch = converter("oklch");

/** Eight-token palette derived from a single primary. */
export interface BrandPalette {
  /** The raw primary — exactly what the tenant picked. */
  primary: string;
  /** Filled-CTA fill — visibly lighter so big surfaces don't shout. */
  primaryFill: string;
  /** Subtle chip / pill background — almost white, faint hue tint. */
  primaryBg: string;
  /** Stronger surface — used for hover / selected states. */
  primarySoft: string;
  /** Deep contrast — text / icons on primary backgrounds. */
  primaryInk: string;
  /** Warm analogous accent (+30°) — for "energetic" surfaces. */
  accentWarm: string;
  /** Cool analogous accent (-30°) — for calm surfaces (info, links). */
  accentCool: string;
  /** Complement (+180°) — used sparingly for callouts. */
  accentComplement: string;
}

const DEFAULT_PRIMARY = "#534ab7";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

interface Oklch {
  mode: "oklch";
  l: number;
  c: number;
  h?: number;
}

/**
 * Parse a hex (or any CSS colour string `culori` understands) into
 * OKLCH. Falls back to the platform purple when the input is
 * invalid, so callers don't need to pre-validate.
 */
function toBase(input: string | null | undefined): Oklch {
  const parsed = parse(input ?? "") ?? parse(DEFAULT_PRIMARY);
  // The fallback is a compile-time constant; `parse` cannot return
  // undefined for it. The non-null assertion narrows the type for
  // downstream consumers.
  return toOklch(parsed!) as Oklch;
}

/** Build a hex from an OKLCH triple, with the hue defaulting to 0. */
function hex(o: Partial<Oklch> & { l: number; c: number; h?: number }): string {
  return formatHex({ mode: "oklch", l: o.l, c: o.c, h: o.h ?? 0 } as Oklch);
}

/**
 * Derive the full brand palette from a single hex. Hand the result
 * to `paletteToCssVars` to get an inline-style object the layout /
 * settings preview can drop on the wrapper.
 */
export function derivePalette(
  input: string | null | undefined,
): BrandPalette {
  const base = toBase(input);
  const baseHue = base.h ?? 0;
  // Cap accent lightness in the mid-band so primaries that are
  // near-black or near-white still produce visible accents.
  const accentL = clamp(base.l, 0.55, 0.72);
  return {
    primary: hex(base),
    primaryFill: hex({
      l: clamp(base.l + 0.12, 0, 0.82),
      c: base.c * 0.85,
      h: baseHue,
    }),
    primaryBg: hex({
      l: 0.97,
      c: Math.min(base.c * 0.35, 0.035),
      h: baseHue,
    }),
    primarySoft: hex({
      l: 0.93,
      c: Math.min(base.c * 0.5, 0.055),
      h: baseHue,
    }),
    primaryInk: hex({
      l: clamp(base.l - 0.22, 0.2, 1),
      c: base.c * 0.95,
      h: baseHue,
    }),
    accentWarm: hex({
      l: accentL,
      c: base.c * 0.7,
      h: (baseHue + 30) % 360,
    }),
    accentCool: hex({
      l: accentL,
      c: base.c * 0.7,
      h: (baseHue - 30 + 360) % 360,
    }),
    accentComplement: hex({
      l: accentL,
      c: base.c * 0.55,
      h: (baseHue + 180) % 360,
    }),
  };
}

/**
 * Convert a palette into the inline `style` object the consumer
 * layout puts on the wrapper. Every entry is a CSS custom property
 * the consumer components read via `var(--brand-*)`.
 */
export function paletteToCssVars(palette: BrandPalette): CSSProperties {
  return {
    ["--brand-primary" as string]: palette.primary,
    ["--brand-primary-fill" as string]: palette.primaryFill,
    ["--brand-primary-bg" as string]: palette.primaryBg,
    ["--brand-primary-soft" as string]: palette.primarySoft,
    ["--brand-primary-ink" as string]: palette.primaryInk,
    ["--brand-accent-warm" as string]: palette.accentWarm,
    ["--brand-accent-cool" as string]: palette.accentCool,
    ["--brand-accent-complement" as string]: palette.accentComplement,
  } as CSSProperties;
}
