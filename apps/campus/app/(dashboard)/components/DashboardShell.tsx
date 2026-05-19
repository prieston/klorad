"use client";

import type { ReactNode } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { AppShell, type NavItem } from "@klorad/design-system";
import {
  OrganizationSwitcher,
  UserAccountMenu,
  DashboardIcon,
  MapIcon,
  SettingsIcon,
} from "@klorad/ui";
import { signOut, useSession } from "next-auth/react";
import { useOrganization, useOrganizations } from "@/app/hooks/useOrganizations";

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
          className="flex items-center"
        >
          <Image
            src="/images/logo/klorad-campus-logo-white.svg"
            alt="Klorad Campus"
            width={140}
            height={32}
            priority
            className="h-8 w-auto"
          />
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
