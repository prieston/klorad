import Link from "next/link";
import { ChevronRight, Coffee } from "lucide-react";

export interface DiningRowProps {
  /** Display name. */
  name: string;
  /** Free-text status — e.g. "Open now · 5 min" / "Mon-Fri 8-22". */
  status?: string;
  /** Where the row links to — usually the dining list page or the map. */
  href: string;
}

/**
 * Single dining row used in the home's "Dining now" rail. Soft icon
 * chip + name + status, with a right chevron affordance. Whole row
 * is clickable.
 */
export function DiningRow({ name, status, href }: DiningRowProps) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-2xl border border-[var(--brand-line)] bg-white px-4 py-3 transition-colors hover:border-[var(--brand-primary)]"
    >
      <span
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: "var(--brand-primary-bg)" }}
      >
        <Coffee
          size={18}
          strokeWidth={1.75}
          style={{ color: "var(--brand-primary)" }}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-[var(--brand-text)]">
          {name}
        </span>
        {status ? (
          <span className="mt-0.5 block truncate text-xs text-[var(--brand-text-muted)]">
            {status}
          </span>
        ) : null}
      </span>
      <ChevronRight
        size={18}
        strokeWidth={1.75}
        className="shrink-0 text-[var(--brand-text-muted)] transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
}
