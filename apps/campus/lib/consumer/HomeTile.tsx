import Link from "next/link";
import type { LucideIcon } from "lucide-react";

type Variant = "default" | "primary";
export type HomeTileAccent = "primary" | "warm" | "cool" | "complement";

const ACCENT_VAR: Record<HomeTileAccent, string> = {
  primary: "var(--brand-primary-fill)",
  warm: "var(--brand-accent-warm)",
  cool: "var(--brand-accent-cool)",
  complement: "var(--brand-accent-complement)",
};

export interface HomeTileProps {
  href: string;
  label: string;
  icon: LucideIcon;
  /**
   * Which palette accent to use for the icon chip. Defaults to
   * `primary` (a faint tint of `--brand-primary-fill`). Picking a
   * different accent per tile keeps the four-up grid visually
   * varied while every colour still derives from the campus's
   * primary in Settings.
   */
  accent?: HomeTileAccent;
  /**
   * `primary` fills the tile with the raw brand colour — used for
   * the **Ask Klio** tile, the only emphasised CTA on the grid.
   * `default` is a soft accent chip on a white card.
   */
  variant?: Variant;
}

/**
 * Square-ish action tile for the home grid. Icon-on-top, label
 * below, four-up on mobile. Two visual modes:
 *
 *   - `default` — white card with a soft chip background derived
 *     from `accent`. The chip uses a `color-mix` 14%-on-white tint
 *     of the chosen palette colour; the icon itself sits in the
 *     full saturation of that colour.
 *   - `primary` — filled with raw `--brand-primary`; the home's
 *     single eye-catch. Always rendered full strength so the AI
 *     CTA reads as the main action, not just another tile.
 */
export function HomeTile({
  href,
  label,
  icon: Icon,
  accent = "primary",
  variant = "default",
}: HomeTileProps) {
  if (variant === "primary") {
    return (
      <Link
        href={href}
        className="group flex flex-col items-start gap-2 rounded-2xl p-4 text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: "var(--brand-primary)" }}
      >
        <span
          aria-hidden
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20"
        >
          <Icon size={20} strokeWidth={1.75} className="text-white" />
        </span>
        <span className="text-sm font-semibold">{label}</span>
      </Link>
    );
  }
  const accentColor = ACCENT_VAR[accent];
  return (
    <Link
      href={href}
      className="group flex flex-col items-start gap-2 rounded-2xl border border-[var(--brand-line)] bg-white p-4 transition-colors hover:border-[var(--brand-primary)]"
    >
      <span
        aria-hidden
        className="flex h-10 w-10 items-center justify-center rounded-xl"
        style={{
          backgroundColor: `color-mix(in srgb, ${accentColor} 14%, #ffffff)`,
        }}
      >
        <Icon
          size={20}
          strokeWidth={1.75}
          style={{ color: accentColor }}
        />
      </span>
      <span className="text-sm font-medium text-[var(--brand-text)]">
        {label}
      </span>
    </Link>
  );
}
