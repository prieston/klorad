"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Map as MapIcon, List, Sparkles } from "lucide-react";
import {
  MobileBottomNav,
  type MobileBottomNavItem,
} from "@klorad/design-system";

interface Props {
  slug: string;
}

type TabKey = "map" | "devices" | "paris";

const ITEMS: MobileBottomNavItem[] = [
  { key: "map", label: "Map", icon: MapIcon },
  { key: "devices", label: "Devices", icon: List },
  { key: "paris", label: "Paris", icon: Sparkles },
];

function resolveActiveTab(pathname: string, slug: string): TabKey {
  const base = `/w/${slug}`;
  if (pathname.startsWith(`${base}/devices`)) return "devices";
  if (pathname.startsWith(`${base}/paris`)) return "paris";
  return "map";
}

/**
 * Mobility's mobile bottom nav — three tabs for the per-world PWA:
 *   Map     — the existing WorldViewer (Mapbox with device pins)
 *   Devices — the list view (table on mobile, drawer on tap)
 *   Paris   — the read-only AI assistant scoped to this world
 *
 * Wraps the DS `MobileBottomNav` primitive with Next `Link` routing +
 * optimistic active-state (pill flips instantly on tap; the server-
 * rendered page fills in behind it). Hidden on desktop where the
 * operator dashboard's nav takes over.
 */
export function MobilityBottomNav({ slug }: Props) {
  const pathname = usePathname() ?? `/w/${slug}`;
  const activeFromPath = resolveActiveTab(pathname, slug);
  const [pendingKey, setPendingKey] = useState<TabKey | null>(null);
  const activeKey = pendingKey ?? activeFromPath;

  useEffect(() => {
    if (pendingKey && activeFromPath === pendingKey) {
      setPendingKey(null);
    }
  }, [activeFromPath, pendingKey]);

  const hrefForKey = (key: TabKey): string => {
    switch (key) {
      case "map":
        return `/w/${slug}`;
      case "devices":
        return `/w/${slug}/devices`;
      case "paris":
        return `/w/${slug}/paris`;
    }
  };

  // Inherit the world's brand colour for the active pill so per-
  // tenant theming lands without prop-drilling.
  const styleVars = {
    ["--accent" as string]: "var(--w-accent, #0ea5e9)",
    ["--accent-contrast" as string]: "#ffffff",
  } as React.CSSProperties;

  return (
    <div style={styleVars}>
      <MobileBottomNav
        className="md:hidden"
        items={ITEMS}
        activeKey={activeKey}
        renderItem={(item, content, isActive) => (
          <Link
            href={hrefForKey(item.key as TabKey)}
            aria-current={isActive ? "page" : undefined}
            aria-label={item.label}
            onClick={() => {
              const key = item.key as TabKey;
              if (key !== activeFromPath) setPendingKey(key);
            }}
            className="flex w-full items-center justify-center"
          >
            {content}
          </Link>
        )}
      />
    </div>
  );
}
