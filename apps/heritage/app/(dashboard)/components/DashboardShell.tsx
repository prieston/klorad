"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import useSWR from "swr";
import { AppShell, KloradMark, type NavGroup } from "@klorad/design-system";

/** OrganizationSwitcher + UserAccountMenu are MUI-backed components.
 *  Emotion's stable-but-not-quite class-name generation drifts between
 *  server and client paint, so SSR'ing them produces hydration mismatch
 *  errors. Loading them client-only sidesteps the drift entirely; the brief
 *  skeleton matches their footprint so the sidebar doesn't reflow when they
 *  pop in.
 *
 *  Imports go through the local `MuiSidebarSlots` wrapper so webpack can
 *  resolve a stable module specifier — pointing `next/dynamic` straight at
 *  `@klorad/ui` trips its pnpm-symlinked exports map. */
const OrganizationSwitcher = dynamic(
  () => import("./MuiSidebarSlots").then((m) => m.OrganizationSwitcher),
  {
    ssr: false,
    loading: () => (
      <div className="h-12 animate-pulse rounded-lg bg-surface-2" aria-hidden />
    ),
  },
);
const UserAccountMenu = dynamic(
  () => import("./MuiSidebarSlots").then((m) => m.UserAccountMenu),
  {
    ssr: false,
    loading: () => (
      <div className="h-14 animate-pulse rounded-lg bg-surface-2" aria-hidden />
    ),
  },
);
import {
  BadgeCheck,
  BarChart3,
  Boxes,
  Building2,
  ChevronLeft,
  Compass,
  Landmark,
  LayoutDashboard,
  Languages,
  Layers,
  Megaphone,
  Moon,
  Route,
  ScanLine,
  Scale,
  Settings,
  ShieldCheck,
  Sun,
  Users,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useOrganization, useOrganizations } from "@/app/hooks/useOrganizations";

const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  });

/**
 * Light/dark toggle. Hand-rolled (no MUI). Reads/writes `klorad-theme` in
 * localStorage and mirrors the class onto `<html>` so the design-system
 * tokens flip with Tailwind's `dark:` variants.
 */
function ThemeToggleButton() {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    setMounted(true);
    try {
      setIsDark(
        document.documentElement.classList.contains("dark") ||
          localStorage.getItem("klorad-theme") === "dark",
      );
    } catch {
      /* storage disabled */
    }
  }, []);
  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    try {
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem("klorad-theme", next ? "dark" : "light");
    } catch {
      /* storage disabled */
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

/** Sidebar card shown inside a venue scope: venue name + publish status +
 *  "All venues" back link. */
function VenueContextHeader({
  orgId,
  venueId,
}: {
  orgId: string;
  venueId: string;
}) {
  const { data } = useSWR<{
    venue: { name: string; isPublished: boolean };
  }>(`/api/venues/${venueId}`, fetcher);
  const venue = data?.venue;
  const dotClass = venue?.isPublished ? "bg-emerald-500" : "bg-text-tertiary";
  return (
    <div className="mt-3 space-y-2">
      <Link
        href={`/org/${orgId}`}
        className="inline-flex items-center gap-1 px-3 text-[11px] font-medium text-text-tertiary hover:text-text-secondary"
      >
        <ChevronLeft size={12} strokeWidth={1.8} aria-hidden />
        All venues
      </Link>
      <div className="rounded-lg px-3 py-2">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`}
          />
          <span className="truncate text-sm font-semibold text-text-primary">
            {venue?.name ?? "Venue"}
          </span>
        </div>
        {venue?.isPublished === false ? (
          <span className="ml-4 text-[11px] text-text-tertiary">Draft</span>
        ) : null}
      </div>
    </div>
  );
}

/** Org-scope nav groups (no venue selected). */
function orgNavGroups(orgId: string, pathname: string): NavGroup[] {
  const prefix = `/org/${orgId}`;
  const is = (segment: string) =>
    pathname === `${prefix}${segment}` ||
    pathname.startsWith(`${prefix}${segment}/`);
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
          label: "Venues",
          href: prefix,
          icon: <Landmark size={16} strokeWidth={1.7} />,
          active: pathname === prefix,
        },
        {
          label: "Compliance",
          href: `${prefix}/compliance`,
          icon: <BadgeCheck size={16} strokeWidth={1.7} />,
          active: is("/compliance"),
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
          active: is("/settings/general"),
        },
      ],
    },
  ];
}

/**
 * Venue-scope navigation, in the order the work actually happens.
 *
 * The previous grouping — Record, Capture, Experience, Publish — mirrored the
 * data model: the abstract record first, the captures of it second, the scenes
 * third. That is the right shape for a CIDOC-CRM database and the wrong shape
 * for a person. Nobody arrives thinking "I will create a record and later
 * associate a depiction with it". They arrive thinking "I have a model of a
 * statue".
 *
 * So the spine is now: bring something in, describe it, arrange it, guide
 * people through it. Everything that is a report rather than a task drops
 * below into Manage, where it can be found and is not in the way.
 *
 * Every item carries a `hint`. The names of the concepts here are the product;
 * a curator who cannot tell what "Scenes" means from the sidebar will not find
 * out by clicking, and a tooltip they have to hunt for is not an answer.
 */
function venueNavGroups(
  orgId: string,
  venueId: string,
  pathname: string,
): NavGroup[] {
  const prefix = `/org/${orgId}/venues/${venueId}`;
  const is = (segment: string) =>
    pathname === `${prefix}${segment}` ||
    pathname.startsWith(`${prefix}${segment}/`);
  return [
    {
      items: [
        {
          label: "Start here",
          href: prefix,
          icon: <Compass size={16} strokeWidth={1.7} />,
          active: pathname === prefix,
        },
      ],
    },
    {
      label: "Build",
      items: [
        {
          label: "Items",
          href: `${prefix}/items`,
          icon: <Boxes size={16} strokeWidth={1.7} />,
          active: is("/items"),
        },
        {
          label: "Scenes",
          href: `${prefix}/scenes`,
          icon: <Layers size={16} strokeWidth={1.7} />,
          active: is("/scenes"),
        },
        {
          label: "Tours",
          href: `${prefix}/tours`,
          icon: <Route size={16} strokeWidth={1.7} />,
          active: is("/tours"),
        },
      ],
    },
    {
      label: "Manage",
      items: [
        {
          label: "Files",
          href: `${prefix}/files`,
          icon: <ScanLine size={16} strokeWidth={1.7} />,
          active: is("/files"),
        },
        {
          label: "Places",
          href: `${prefix}/places`,
          icon: <Building2 size={16} strokeWidth={1.7} />,
          active: is("/places"),
        },
        {
          label: "Copyright",
          href: `${prefix}/rights`,
          icon: <Scale size={16} strokeWidth={1.7} />,
          active: is("/rights"),
        },
        {
          label: "Translations",
          href: `${prefix}/languages`,
          icon: <Languages size={16} strokeWidth={1.7} />,
          active: is("/languages"),
        },
        {
          label: "How it was made",
          href: `${prefix}/paradata`,
          icon: <ShieldCheck size={16} strokeWidth={1.7} />,
          active: is("/paradata"),
        },
      ],
    },
    {
      label: "Audience",
      items: [
        {
          label: "Visitors",
          href: `${prefix}/analytics`,
          icon: <BarChart3 size={16} strokeWidth={1.7} />,
          active: is("/analytics"),
        },
        {
          label: "Notifications",
          href: `${prefix}/reach`,
          icon: <Megaphone size={16} strokeWidth={1.7} />,
          active: is("/reach"),
        },
        {
          label: "Settings",
          href: `${prefix}/settings`,
          icon: <Settings size={16} strokeWidth={1.7} />,
          active: is("/settings"),
        },
      ],
    },
  ];
}

export default function DashboardShell({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const params = useParams<{ orgId?: string; venueId?: string }>();
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const orgId = params?.orgId ?? "";
  const venueId = params?.venueId ?? "";
  const { organizations, loadingOrganizations } = useOrganizations();
  const { organization: currentOrganization, loadingOrganization } =
    useOrganization(orgId);

  const inVenueScope = Boolean(venueId);
  const navGroups = inVenueScope
    ? venueNavGroups(orgId, venueId, pathname)
    : orgNavGroups(orgId, pathname);

  return (
    <AppShell
      linkComponent={Link}
      brand={
        <Link
          href={orgId ? `/org/${orgId}` : "/"}
          aria-label="Klorad Heritage"
          className="flex items-center gap-2 no-underline"
        >
          <KloradMark className="h-7 w-auto" title="" />
          <span className="text-sm font-semibold tracking-tight text-text-primary">
            Heritage
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
            buildHref={(id) => `/org/${id}`}
            linkComponent={Link}
          />
          {inVenueScope ? (
            <VenueContextHeader orgId={orgId} venueId={venueId} />
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
