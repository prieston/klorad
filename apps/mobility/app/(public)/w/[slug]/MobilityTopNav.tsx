"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { List, Map as MapIcon, Sparkles } from "lucide-react";
import { KloradMark } from "@klorad/design-system";
import { MobilitySettingsMenu } from "./MobilitySettingsMenu";

interface Props {
  slug: string;
  /** World display name — shown next to the logo. */
  worldName: string;
  /** Optional per-world logo URL from `MobilityWorld.theme.logoUrl`.
   *  When present, replaces the KloradMark + world name lockup. */
  logoUrl: string | null;
}

interface NavLink {
  key: "map" | "devices" | "paris";
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
}

function resolveActiveTab(
  pathname: string,
  slug: string,
): "map" | "devices" | "paris" {
  const base = `/w/${slug}`;
  if (pathname.startsWith(`${base}/devices`)) return "devices";
  if (pathname.startsWith(`${base}/paris`)) return "paris";
  return "map";
}

/**
 * Mobility's top nav — sticky white bar that persists across tab
 * routes so the world feels like a native app rather than a
 * multi-page site. Mirrors Campus's `ConsumerNav` pattern:
 *
 *   - Left: world logo (from `theme.logoUrl`) + name, links to Map.
 *   - Centre (desktop only): inline Map / Devices / Paris links.
 *     Active link picks up the world's accent colour.
 *   - Right: `MobilitySettingsMenu` dropdown — identity,
 *     notifications toggle, sign in/out.
 *
 * On mobile the tab links collapse and the bottom nav takes over
 * (`MobileBottomNav` in the layout with `md:hidden`). This keeps
 * the top bar tight enough for a phone header without losing the
 * settings + logo affordances.
 */
export function MobilityTopNav({ slug, worldName, logoUrl }: Props) {
  const pathname = usePathname() ?? `/w/${slug}`;
  const active = resolveActiveTab(pathname, slug);

  const links: NavLink[] = [
    { key: "map", label: "Map", href: `/w/${slug}`, icon: MapIcon },
    {
      key: "devices",
      label: "Devices",
      href: `/w/${slug}/devices`,
      icon: List,
    },
    {
      key: "paris",
      label: "Paris",
      href: `/w/${slug}/paris`,
      icon: Sparkles,
    },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--w-border,#e6e6ea)] bg-white">
      <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between gap-4 px-4 md:px-6">
        <Link
          href={`/w/${slug}`}
          className="flex shrink-0 items-center gap-2"
          aria-label={`${worldName} home`}
        >
          {logoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={logoUrl}
              alt={worldName}
              className="h-9 max-w-[180px] rounded-lg object-contain"
            />
          ) : (
            <>
              <KloradMark className="h-8 w-8" />
              <span className="text-base font-medium text-[var(--w-fg,#1a1a1a)]">
                {worldName}
              </span>
            </>
          )}
        </Link>

        <nav
          aria-label="Primary"
          className="hidden items-center gap-1 md:flex"
        >
          {links.map((l) => {
            const isActive = active === l.key;
            const Icon = l.icon;
            return (
              <Link
                key={l.key}
                href={l.href}
                aria-current={isActive ? "page" : undefined}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-[var(--w-accent,#0ea5e9)] text-[var(--w-accent-contrast,#ffffff)]"
                    : "text-[var(--w-fg-muted,#6b6b6b)] hover:text-[var(--w-fg,#1a1a1a)]"
                }`}
              >
                <Icon size={13} strokeWidth={1.8} />
                {l.label}
              </Link>
            );
          })}
        </nav>

        <MobilitySettingsMenu slug={slug} />
      </div>
    </header>
  );
}
