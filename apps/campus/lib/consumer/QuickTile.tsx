import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { AccentName } from "./types";

const ACCENT_HEX: Record<AccentName, string> = {
  purple: "var(--brand-primary)",
  coral: "#D85A30",
  teal: "#1D9E75",
  pink: "#D4537E",
};

export interface QuickTileProps {
  href: string;
  label: string;
  subtitle: string;
  icon: LucideIcon;
  accent: AccentName;
}

/**
 * One of the three quick-action cards under the hero. White card,
 * colored icon chip on the left, label + one-line subtitle on the
 * right. Whole card is clickable.
 */
export function QuickTile({
  href,
  label,
  subtitle,
  icon: Icon,
  accent,
}: QuickTileProps) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-4 rounded-2xl border border-[var(--brand-line)] bg-white p-5 transition-colors hover:border-[var(--brand-primary)]"
    >
      <span
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
        style={{ backgroundColor: ACCENT_HEX[accent] }}
      >
        <Icon size={20} strokeWidth={1.75} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-[var(--brand-text)]">
          {label}
        </span>
        <span className="mt-0.5 block text-xs text-[var(--brand-text-muted)]">
          {subtitle}
        </span>
      </span>
    </Link>
  );
}
