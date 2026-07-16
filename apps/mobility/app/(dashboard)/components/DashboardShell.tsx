"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import useSWR from "swr";
import {
  AppShell,
  type NavGroup,
} from "@klorad/design-system";

/** OrganizationSwitcher + UserAccountMenu are MUI-backed components.
 *  Emotion's stable-but-not-quite class-name generation drifts between
 *  server and client paint, so SSR'ing them produces hydration
 *  mismatch errors. Loading them client-only sidesteps the drift
 *  entirely; the brief skeleton matches their footprint so the
 *  sidebar doesn't reflow when they pop in.
 *
 *  Imports go through the local `MuiSidebarSlots` wrapper so webpack
 *  can resolve a stable module specifier — pointing `next/dynamic`
 *  straight at `@klorad/ui` trips its pnpm-symlinked exports map. */
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
  Bell,
  Brush,
  Building2,
  ChevronLeft,
  Compass,
  Database,
  Globe2,
  LayoutDashboard,
  Layers,
  ListTodo,
  Megaphone,
  Moon,
  Radio,
  Settings,
  Sun,
  Users,
  UsersRound,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import {
  useOrganization,
  useOrganizations,
} from "@/app/hooks/useOrganizations";

const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  });

/**
 * Light/dark toggle. Hand-rolled (no MUI). Reads/writes `klorad-theme`
 * in localStorage and mirrors the class onto `<html>` so the design-
 * system tokens flip with Tailwind's `dark:` variants.
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

/** Sidebar card shown when inside a project scope. Project name +
 *  publish status + "All projects" back link. */
function ProjectContextHeader({
  orgId,
  projectId,
}: {
  orgId: string;
  projectId: string;
}) {
  const { data } = useSWR<{
    project: { title: string; isPublished: boolean };
  }>(`/api/projects/${projectId}`, fetcher);
  const project = data?.project;
  const dotClass = project?.isPublished ? "bg-emerald-500" : "bg-text-tertiary";
  return (
    <div className="mt-3 space-y-2">
      <Link
        href={`/org/${orgId}`}
        className="inline-flex items-center gap-1 px-3 text-[11px] font-medium text-text-tertiary hover:text-text-secondary"
      >
        <ChevronLeft size={12} strokeWidth={1.8} aria-hidden />
        All projects
      </Link>
      <div className="rounded-lg px-3 py-2">
        <div className="flex items-center gap-2">
          <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
          <span className="truncate text-sm font-semibold text-text-primary">
            {project?.title ?? "Project"}
          </span>
        </div>
        {project?.isPublished === false ? (
          <span className="ml-4 text-[11px] text-text-tertiary">Draft</span>
        ) : null}
      </div>
    </div>
  );
}

/** Org-scope nav groups (no project selected). */
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
          label: "Projects",
          href: prefix,
          icon: <Building2 size={16} strokeWidth={1.7} />,
          active: pathname === prefix,
        },
        {
          label: "Members",
          href: `${prefix}/settings/members`,
          icon: <Users size={16} strokeWidth={1.7} />,
          active: is("/settings/members"),
        },
        {
          label: "Teams",
          href: `${prefix}/teams`,
          icon: <UsersRound size={16} strokeWidth={1.7} />,
          active: is("/teams"),
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

/** Project-scope nav groups (URL has a projectId). */
function projectNavGroups(
  orgId: string,
  projectId: string,
  pathname: string,
): NavGroup[] {
  const prefix = `/org/${orgId}/projects/${projectId}`;
  const is = (segment: string) =>
    pathname === `${prefix}${segment}` ||
    pathname.startsWith(`${prefix}${segment}/`);
  return [
    {
      label: "Operator",
      items: [
        {
          label: "Console",
          href: prefix,
          icon: <Compass size={16} strokeWidth={1.7} />,
          active: pathname === prefix,
        },
        {
          label: "Devices",
          href: `${prefix}/devices`,
          icon: <Layers size={16} strokeWidth={1.7} />,
          active: is("/devices"),
        },
        {
          label: "Alerts",
          href: `${prefix}/alerts`,
          icon: <Bell size={16} strokeWidth={1.7} />,
          active: is("/alerts"),
        },
      ],
    },
    {
      label: "Publish",
      items: [
        {
          label: "Worlds",
          href: `${prefix}/worlds`,
          icon: <Radio size={16} strokeWidth={1.7} />,
          active: is("/worlds"),
        },
      ],
    },
    {
      label: "Manage",
      items: [
        {
          label: "Data sources",
          href: `${prefix}/sources`,
          icon: <Database size={16} strokeWidth={1.7} />,
          active: is("/sources"),
        },
        {
          label: "Identity",
          href: `${prefix}/identity`,
          icon: <Globe2 size={16} strokeWidth={1.7} />,
          active: is("/identity"),
        },
        {
          label: "Device styles",
          href: `${prefix}/styles`,
          icon: <Brush size={16} strokeWidth={1.7} />,
          active: is("/styles"),
        },
        {
          label: "Members",
          href: `${prefix}/members`,
          icon: <Users size={16} strokeWidth={1.7} />,
          active: is("/members"),
        },
        {
          label: "Reach",
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
    {
      label: "Curation",
      items: [
        {
          label: "Discovered devices",
          href: `${prefix}/discovered`,
          icon: <ListTodo size={16} strokeWidth={1.7} />,
          active: is("/discovered"),
        },
      ],
    },
  ];
}

export default function DashboardShell({
  children,
}: {
  children: ReactNode;
}) {
  const { data: session } = useSession();
  const params = useParams<{ orgId?: string; projectId?: string }>();
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const orgId = params?.orgId ?? "";
  const projectId = params?.projectId ?? "";
  const { organizations, loadingOrganizations } = useOrganizations();
  const { organization: currentOrganization, loadingOrganization } =
    useOrganization(orgId);

  const inProjectScope = Boolean(projectId);
  const navGroups = inProjectScope
    ? projectNavGroups(orgId, projectId, pathname)
    : orgNavGroups(orgId, pathname);

  return (
    <AppShell
      linkComponent={Link}
      brand={
        <Link
          href={orgId ? `/org/${orgId}` : "/"}
          aria-label="PSMdt Digital Twins"
          className="flex items-center no-underline"
        >
          {/* Operator-side branding — the horizontal PSMdt mark
              already carries "DIGITAL TWINS" so the row stays clean
              on its own. Plain <img> instead of next/image because
              the asset ships from /public on the same origin and
              benefits from the simpler render path. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/psm-logo.png"
            alt="PSMdt Digital Twins"
            className="h-8 w-auto"
          />
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
          {inProjectScope ? (
            <ProjectContextHeader orgId={orgId} projectId={projectId} />
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
