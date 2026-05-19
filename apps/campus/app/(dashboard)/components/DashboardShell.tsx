"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell, KloradMark, type NavItem } from "@klorad/design-system";
import {
  OrganizationSwitcher,
  UserAccountMenu,
  DashboardIcon,
  MapIcon,
  SettingsIcon,
  useThemeMode,
} from "@klorad/ui";
import { signOut, useSession } from "next-auth/react";
import { useOrganization, useOrganizations } from "@/app/hooks/useOrganizations";

/** Light/dark toggle, driven by @klorad/ui's ThemeModeProvider. */
function ThemeToggleButton() {
  const { mode, toggle } = useThemeMode();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mode === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle color theme"
      className="flex h-9 w-9 items-center justify-center rounded-full border border-line-soft text-text-secondary transition-colors hover:border-accent hover:text-text-primary"
    >
      {mounted ? (
        isDark ? (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
          </svg>
        ) : (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
          </svg>
        )
      ) : (
        <span className="block h-4 w-4" />
      )}
    </button>
  );
}

export default function DashboardShell({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const params = useParams<{ orgId: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const orgId = params?.orgId ?? "";
  const pathPrefix = orgId ? `/org/${orgId}` : "";
  const { organizations, loadingOrganizations } = useOrganizations();
  const { organization: currentOrganization, loadingOrganization } =
    useOrganization(orgId);

  // Builder routes have their own dedicated layout — no dashboard shell.
  const isBuilder = pathname?.includes("/builder") ?? false;
  if (isBuilder) {
    return <main className="min-h-screen">{children}</main>;
  }

  const nav: NavItem[] = [
    {
      label: "Dashboard",
      href: `${pathPrefix}/dashboard`,
      icon: <DashboardIcon fontSize="small" />,
      active: pathname?.includes("/dashboard") ?? false,
    },
    {
      label: "Campuses",
      href: `${pathPrefix}/maps`,
      icon: <MapIcon fontSize="small" />,
      active: pathname?.includes("/maps") ?? false,
    },
    {
      label: "Settings",
      href: `${pathPrefix}/settings/general`,
      icon: <SettingsIcon fontSize="small" />,
      active: pathname?.includes("/settings") ?? false,
    },
  ];

  return (
    <AppShell
      linkComponent={Link}
      brand={
        <Link
          href={orgId ? `/org/${orgId}/dashboard` : "/"}
          aria-label="Klorad Campus"
          className="flex items-center gap-2.5"
        >
          <KloradMark className="h-7 w-auto" />
          <span className="text-sm font-semibold tracking-tight text-text-primary">
            Klorad Campus
          </span>
        </Link>
      }
      sidebarHeader={
        <OrganizationSwitcher
          organizations={organizations}
          currentOrgId={orgId}
          currentOrganization={currentOrganization}
          loading={loadingOrganizations || loadingOrganization}
          buildHref={(id) => `/org/${id}/dashboard`}
          linkComponent={Link}
        />
      }
      nav={nav}
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
          profileActive={pathname?.includes("/profile") ?? false}
        />
      }
    >
      {children}
    </AppShell>
  );
}
