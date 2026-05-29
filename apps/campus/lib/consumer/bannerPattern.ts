/**
 * Diagonal-stripe pattern helper for event / news / club banners.
 *
 * Returns an inline `background` value that paints ~1.5 px stripes
 * of the given accent on a very faint tint of the same accent —
 * the playful "Talk" / "Film" banner treatment in the mobile
 * mockup. The accent is supplied as any CSS colour expression
 * (raw hex, `var(...)`, or `color-mix(...)`) so callers can plug
 * in palette tokens directly.
 */
import type { CSSProperties } from "react";

const STRIPE_WIDTH_PX = 1.5;
const STRIPE_GAP_PX = 9;

/**
 * @param accent  Any CSS colour expression.
 * @param tintPct How saturated the soft bg should be — 12 for small
 *   card banners, 22 for full-bleed hero covers (so the rounded
 *   white card on top reads as a visibly distinct surface).
 */
export function stripedBanner(accent: string, tintPct = 12): CSSProperties {
  return {
    backgroundImage: `repeating-linear-gradient(-45deg, ${accent} 0, ${accent} ${STRIPE_WIDTH_PX}px, transparent ${STRIPE_WIDTH_PX}px, transparent ${STRIPE_GAP_PX}px)`,
    backgroundColor: `color-mix(in srgb, ${accent} ${tintPct}%, #ffffff)`,
  };
}
