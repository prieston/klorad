import Link from "next/link";
import {
  ArrowRight,
  Compass,
  Home,
  Megaphone,
  Newspaper,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Tile {
  label: string;
  href: string;
  Icon: LucideIcon;
}

interface Props {
  orgId: string;
  mapId: string;
}

/**
 * The four shortcuts at the bottom of the campus dashboard — the
 * surfaces rectors open most often. Routes are stable across the
 * redesign per the agreed plan; only the labels track the new IA.
 */
export function JumpBackInTiles({ orgId, mapId }: Props) {
  const prefix = `/org/${orgId}/maps/${mapId}`;
  const tiles: Tile[] = [
    { label: "Home", href: `${prefix}/home`, Icon: Home },
    {
      label: "Map & Wayfinding",
      href: `${prefix}/map`,
      Icon: Compass,
    },
    { label: "Post news", href: `${prefix}/news`, Icon: Newspaper },
    {
      label: "Send a broadcast",
      href: `${prefix}/reach`,
      Icon: Megaphone,
    },
  ];

  return (
    <section className="rounded-2xl border border-line-soft bg-surface-1 p-6">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-text-primary">
          Jump back in
        </h2>
        <p className="mt-0.5 text-xs text-text-tertiary">
          The surfaces students open most.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {tiles.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="group flex items-center justify-between gap-3 rounded-xl border border-line-soft bg-surface-2/40 px-4 py-3 transition-colors hover:border-line-strong hover:bg-surface-2"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <t.Icon size={16} strokeWidth={1.75} aria-hidden />
              </span>
              <span className="text-sm font-medium text-text-primary">
                {t.label}
              </span>
            </span>
            <ArrowRight
              size={14}
              strokeWidth={1.75}
              className="text-text-tertiary transition-colors group-hover:text-text-primary"
              aria-hidden
            />
          </Link>
        ))}
      </div>
    </section>
  );
}
