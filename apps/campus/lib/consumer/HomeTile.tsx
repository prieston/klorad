import Link from "next/link";
import type { LucideIcon } from "lucide-react";

type Variant = "default" | "primary";

const ICON_CHIP_BG: Record<string, string> = {
  blue: "#E4ECFB",
  green: "#E3F4EB",
  purple: "#EDE7FB",
  coral: "#FBE2D6",
};

const ICON_CHIP_FG: Record<string, string> = {
  blue: "#3D6CC2",
  green: "#1D9E75",
  purple: "var(--brand-primary)",
  coral: "#C24A1F",
};

export interface HomeTileProps {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Colour key for the soft icon chip — purple is the brand default. */
  accent?: "blue" | "green" | "purple" | "coral";
  /**
   * `primary` fills the tile with the brand accent and inverts the
   * icon chip — used for the **Ask Klio** tile, the single
   * stand-out CTA on the home grid.
   */
  variant?: Variant;
}

/**
 * Square-ish action tile for the home grid. Icon-on-top, label
 * below, four-up on mobile. Two visual modes:
 *
 *   - `default` — soft icon chip on a white card. Tap target.
 *   - `primary` — filled accent card, white icon, white label. The
 *     home's only emphasized CTA so the eye lands on it first.
 */
export function HomeTile({
  href,
  label,
  icon: Icon,
  accent = "purple",
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
  return (
    <Link
      href={href}
      className="group flex flex-col items-start gap-2 rounded-2xl border border-[var(--brand-line)] bg-white p-4 transition-colors hover:border-[var(--brand-primary)]"
    >
      <span
        aria-hidden
        className="flex h-10 w-10 items-center justify-center rounded-xl"
        style={{ backgroundColor: ICON_CHIP_BG[accent] }}
      >
        <Icon
          size={20}
          strokeWidth={1.75}
          style={{ color: ICON_CHIP_FG[accent] }}
        />
      </span>
      <span className="text-sm font-medium text-[var(--brand-text)]">
        {label}
      </span>
    </Link>
  );
}
