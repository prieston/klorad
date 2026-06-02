"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Home, Map as MapIcon, LayoutGrid, Sparkles } from "lucide-react";
import {
  MobileBottomNav,
  type MobileBottomNavItem,
} from "@klorad/design-system";
import { detectLocale } from "@/app/lib/i18n-core";

interface Props {
  /** Token in the public URL. Used to build all four hrefs. */
  token: string;
}

type TabKey = "home" | "map" | "explore" | "klio";

const ITEMS: MobileBottomNavItem[] = [
  { key: "home", label: "Home", icon: Home },
  { key: "map", label: "Map", icon: MapIcon },
  { key: "explore", label: "Explore", icon: LayoutGrid },
  { key: "klio", label: "Klio", icon: Sparkles },
];

/**
 * Match the current pathname to one of the four primary tabs.
 * Detail pages (`/events/[id]`, `/clubs/[id]`, `/news/[id]`) and the
 * legacy `/news` / `/events` / `/clubs` / `/dining` list routes all
 * resolve to **Explore** so the active pill stays consistent while
 * the visitor drills through content. Anything else falls back to
 * **Home**.
 */
function resolveActiveTab(pathname: string, token: string): TabKey {
  const base = `/campus/${token}`;
  if (pathname === base || pathname === `${base}/`) return "home";
  if (pathname.startsWith(`${base}/map`)) return "map";
  if (pathname.startsWith(`${base}/klio`)) return "klio";
  if (
    pathname.startsWith(`${base}/explore`) ||
    pathname.startsWith(`${base}/news`) ||
    pathname.startsWith(`${base}/events`) ||
    pathname.startsWith(`${base}/clubs`) ||
    pathname.startsWith(`${base}/dining`)
  ) {
    return "explore";
  }
  return "home";
}

/**
 * Campus's mobile bottom nav — wires the four primary tabs (Home,
 * Map, Explore, Klio) to the public routes. Wraps the
 * `MobileBottomNav` primitive from the design system and supplies
 * the routing layer via Next `Link`.
 *
 * Hidden on desktop (`md:hidden`) where the top `ConsumerNav` takes
 * over.
 *
 * **Optimistic active state** — taps flip the pill immediately
 * instead of waiting for the route to commit. Next's `Link` already
 * navigates inside a React transition, but the pathname doesn't
 * update until the new route's HTML streams in (~100-500ms on a
 * cold cache), and `usePathname` resolves to the *previous* URL
 * during that window. Tracking a `pendingKey` and rendering it as
 * active until the pathname catches up closes the perceived gap to
 * zero — the rest of the body still shows the skeleton from
 * `loading.tsx` until the new page lands.
 */
export function CampusBottomNav({ token }: Props) {
  const pathname = usePathname() ?? `/campus/${token}`;
  const searchParams = useSearchParams();
  const locale = detectLocale(searchParams?.get("lang") ?? null);
  const activeFromPath = resolveActiveTab(pathname, token);
  const [pendingKey, setPendingKey] = useState<TabKey | null>(null);
  const activeKey = pendingKey ?? activeFromPath;
  const lang = `?lang=${locale}`;

  // Clear the optimistic pending state the moment the URL catches up.
  // Doing this in an effect rather than inline avoids a flash where
  // both `pendingKey` and `activeFromPath` briefly agree and we
  // re-render with stale state.
  useEffect(() => {
    if (pendingKey && activeFromPath === pendingKey) {
      setPendingKey(null);
    }
  }, [activeFromPath, pendingKey]);

  const hrefForKey = (key: TabKey): string => {
    switch (key) {
      case "home":
        return `/campus/${token}${lang}`;
      case "map":
        return `/campus/${token}/map${lang}`;
      case "explore":
        // /explore is a server-side redirect to /events — going straight
        // to /events avoids the extra roundtrip + the visible white
        // flash on tap. The redirect still exists for deep links.
        return `/campus/${token}/events${lang}`;
      case "klio":
        return `/campus/${token}/klio${lang}`;
    }
  };

  // Override the design-system `--accent` and `--accent-contrast`
  // tokens with the campus's brand colour so the active pill picks
  // up `branding.primaryColor` per tenant. Children inherit the
  // var override via the CSS cascade.
  const styleVars = {
    ["--accent" as string]: "var(--brand-primary)",
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
