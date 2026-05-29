"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  AppShell,
  KloradMark,
  type NavGroup,
} from "@klorad/design-system";
import { OrganizationSwitcher, UserAccountMenu } from "@klorad/ui";
import {
  Building2,
  Calendar,
  ChevronLeft,
  Compass,
  Globe2,
  Home,
  LayoutDashboard,
  Megaphone,
  Moon,
  Newspaper,
  Settings,
  Sparkles,
  Sun,
  Users,
  Utensils,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useOrganization, useOrganizations } from "@/app/hooks/useOrganizations";
import { useMaps } from "@/app/hooks/useMaps";

/**
 * Light/dark toggle, hand-rolled (no MUI). Reads/writes `klorad-theme` in
 * localStorage, mirrors the class onto `<html>` so Tailwind's `dark:`
 * variants flip together with the design-system tokens. Hydration
 * guarded so the icon doesn't flash the wrong state.
 */
function ThemeToggleButton() {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const dark =
        document.documentElement.classList.contains("dark") ||
        localStorage.getItem("klorad-theme") === "dark";
      setIsDark(dark);
    } catch {
      // Private mode / storage disabled — leave default.
    }
  }, []);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    try {
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem("klorad-theme", next ? "dark" : "light");
    } catch {
      // See above.
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle color theme"
      className="flex h-9 w-9 items-center justify-center rounded-full border border-line-soft text-text-secondary transition-colors hover:border-accent hover:text-text-primary"
    >
      {mounted ? (
        isDark ? (
          <Sun size={16} strokeWidth={1.7} aria-hidden />
        ) : (
          <Moon size={16} strokeWidth={1.7} aria-hidden />
        )
      ) : (
        <span className="block h-4 w-4" />
      )}
    </button>
  );
}

/**
 * Sidebar block rendered only inside a campus scope (when the URL has a
 * `mapId`). Shows an "All campuses" back link + a card with the current
 * campus name + a status dot. Drives the "you are inside campus X"
 * orientation that the org-level org switcher alone doesn't convey.
 *
 * The campus name comes from `useMaps(orgId)` — already cached SWR, so
 * mounting this on every dashboard page doesn't add a round-trip.
 */
function CampusContextHeader({
  orgId,
  mapId,
}: {
  orgId: string;
  mapId: string;
}) {
  const { maps } = useMaps(orgId);
  const current = maps.find((m) => m.id === mapId);
  const dotClass = current?.isPublished ? "bg-emerald-500" : "bg-text-tertiary";
  return (
    <div className="mt-3 space-y-2">
      <Link
        href={`/org/${orgId}/maps`}
        className="inline-flex items-center gap-1 px-3 text-[11px] font-medium text-text-tertiary hover:text-text-secondary"
      >
        <ChevronLeft size={12} strokeWidth={1.8} aria-hidden />
        All campuses
      </Link>
      <div className="rounded-lg px-3 py-2">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`}
          />
          <span className="truncate text-sm font-semibold text-text-primary">
            {current?.name ?? "Campus"}
          </span>
        </div>
        {current?.isPublished === false ? (
          <span className="ml-4 text-[11px] text-text-tertiary">Draft</span>
        ) : null}
      </div>
    </div>
  );
}

/** Compute the grouped nav for the org-scope rail. */
function orgNavGroups(orgId: string, pathname: string): NavGroup[] {
  const prefix = `/org/${orgId}`;
  const is = (segment: string) =>
    pathname === `${prefix}${segment}` || pathname.startsWith(`${prefix}${segment}/`);
  return [
    {
      label: "Organisation",
      items: [
        {
          label: "Overview",
          href: `${prefix}/dashboard`,
          icon: <LayoutDashboard size={16} strokeWidth={1.7} />,
          active: is("/dashboard"),
        },
        {
          label: "Campuses",
          href: `${prefix}/maps`,
          icon: <Building2 size={16} strokeWidth={1.7} />,
          active: is("/maps") && !pathname.match(/\/maps\/[^/]+/),
        },
        {
          label: "Team",
          href: `${prefix}/settings/members`,
          icon: <Users size={16} strokeWidth={1.7} />,
          active: is("/settings/members"),
        },
        {
          label: "Settings",
          href: `${prefix}/settings/general`,
          icon: <Settings size={16} strokeWidth={1.7} />,
          active:
            is("/settings/general") ||
            is("/settings/usage"),
        },
      ],
    },
  ];
}

/** Compute the grouped nav for the campus-scope rail. */
function campusNavGroups(
  orgId: string,
  mapId: string,
  pathname: string,
): NavGroup[] {
  const prefix = `/org/${orgId}/maps/${mapId}`;
  const is = (segment: string) =>
    pathname === `${prefix}${segment}` || pathname.startsWith(`${prefix}${segment}/`);
  return [
    {
      label: "Overview",
      items: [
        {
          label: "Dashboard",
          href: prefix,
          icon: <LayoutDashboard size={16} strokeWidth={1.7} />,
          // The campus root is the dashboard. Match exactly to avoid
          // every campus-tier sub-route lighting this row.
          active: pathname === prefix,
        },
      ],
    },
    {
      label: "Public surfaces",
      items: [
        {
          label: "Home",
          href: `${prefix}/home`,
          icon: <Home size={16} strokeWidth={1.7} />,
          active: is("/home"),
        },
        {
          label: "Map & Wayfinding",
          href: `${prefix}/map`,
          icon: <Compass size={16} strokeWidth={1.7} />,
          active: is("/map"),
        },
        {
          label: "News",
          href: `${prefix}/news`,
          icon: <Newspaper size={16} strokeWidth={1.7} />,
          active: is("/news"),
        },
        {
          label: "Events",
          href: `${prefix}/events`,
          icon: <Calendar size={16} strokeWidth={1.7} />,
          active: is("/events"),
        },
        {
          label: "Clubs",
          href: `${prefix}/clubs`,
          icon: <Users size={16} strokeWidth={1.7} />,
          active: is("/clubs"),
        },
        {
          label: "Dining",
          href: `${prefix}/dining`,
          icon: <Utensils size={16} strokeWidth={1.7} />,
          active: is("/dining"),
        },
        {
          label: "Klio",
          href: `${prefix}/klio`,
          icon: <Sparkles size={16} strokeWidth={1.7} />,
          active: is("/klio"),
        },
      ],
    },
    {
      label: "Manage",
      items: [
        {
          label: "Reach",
          href: `${prefix}/reach`,
          icon: <Megaphone size={16} strokeWidth={1.7} />,
          active: is("/reach"),
        },
        {
          label: "Identity",
          href: `${prefix}/identity`,
          icon: <Globe2 size={16} strokeWidth={1.7} />,
          active: is("/identity"),
        },
      ],
    },
  ];
}

export default function DashboardShell({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const params = useParams<{ orgId: string; mapId?: string }>();
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const orgId = params?.orgId ?? "";
  const mapId = params?.mapId ?? "";
  const { organizations, loadingOrganizations } = useOrganizations();
  const { organization: currentOrganization, loadingOrganization } =
    useOrganization(orgId);

  // Builder + Workbench routes own the full viewport — no dashboard shell.
  const isFullScreen =
    pathname.includes("/builder") || pathname.includes("/workbench");
  if (isFullScreen) {
    return <main className="min-h-screen">{children}</main>;
  }

  // Two IAs share one shell: organisation tier when no campus is
  // selected, campus tier the moment the URL carries a `mapId`. The
  // sidebar header gains the "← All campuses" back link + a campus
  // status card in the campus scope to anchor the visitor.
  const inCampusScope = Boolean(mapId);
  const navGroups = inCampusScope
    ? campusNavGroups(orgId, mapId, pathname)
    : orgNavGroups(orgId, pathname);

  return (
    <AppShell
      linkComponent={Link}
      brand={
        <Link
          href={orgId ? `/org/${orgId}/dashboard` : "/"}
          aria-label="Klorad Campus"
          className="flex items-center gap-2.5 no-underline"
        >
          <KloradMark className="h-8 w-auto" />
          <span className="flex flex-col leading-none">
            <span className="text-sm font-semibold uppercase tracking-[0.18em] text-text-primary">
              Klorad
            </span>
            <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.26em] text-text-tertiary">
              Campus
            </span>
          </span>
        </Link>
      }
      sidebarHeader={
        <div className="space-y-2">
          <OrganizationSwitcher
            organizations={organizations}
            currentOrgId={orgId}
            currentOrganization={currentOrganization}
            loading={loadingOrganizations || loadingOrganization}
            buildHref={(id) => `/org/${id}/dashboard`}
            linkComponent={Link}
          />
          {inCampusScope ? (
            <CampusContextHeader orgId={orgId} mapId={mapId} />
          ) : null}
        </div>
      }
      navGroups={navGroups}
      actions={<ThemeToggleButton />}
      sidebarFooter={
        <UserAccountMenu
          name={session?.user?.name ?? undefined}
          email={session?.user?.email ?? undefined}
          image={session?.user?.image ?? undefined}
          profileHref={orgId ? `/org/${orgId}/profile` : "/profile"}
          onLogout={async () => {
            await signOut({ callbackUrl: "/auth/signin" });
            router.refresh();
          }}
          profileActive={pathname.includes("/profile")}
        />
      }
    >
      {children}
    </AppShell>
  );
}
