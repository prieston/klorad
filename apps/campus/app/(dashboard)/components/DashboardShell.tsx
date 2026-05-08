"use client";

import type { ReactNode } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Box } from "@mui/material";
import {
  AppSidebar,
  OrganizationSwitcher,
  UserAccountMenu,
  DashboardIcon,
  MapIcon,
  SettingsIcon,
} from "@klorad/ui";
import type { AppSidebarNavItem } from "@klorad/ui";
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
  const { organization: currentOrganization, loadingOrganization } = useOrganization(orgId);

  // Builder routes have their own dedicated left panel.
  const isBuilder = pathname?.includes("/builder") ?? false;
  if (isBuilder) {
    return (
      <Box component="main" sx={{ minHeight: "100vh" }}>
        {children}
      </Box>
    );
  }

  const NAV_ITEMS: AppSidebarNavItem[] = [
    { label: "Dashboard", icon: <DashboardIcon fontSize="small" />, path: "/dashboard" },
    { label: "Campuses", icon: <MapIcon fontSize="small" />, path: "/maps" },
    {
      label: "Settings",
      icon: <SettingsIcon fontSize="small" />,
      path: "/settings",
      subItems: [
        { label: "General", path: "/settings/general" },
        { label: "Members", path: "/settings/members" },
        { label: "Usage", path: "/settings/usage" },
        { label: "Billing", path: "/settings/billing", comingSoon: true },
      ],
    },
  ];

  return (
    <>
      <AppSidebar
        pathname={pathname ?? null}
        navItems={NAV_ITEMS}
        pathPrefix={pathPrefix}
        linkComponent={Link}
        preNav={
          <OrganizationSwitcher
            organizations={organizations}
            currentOrgId={orgId}
            currentOrganization={currentOrganization}
            loading={loadingOrganizations || loadingOrganization}
            buildHref={(id) => `/org/${id}/dashboard`}
            linkComponent={Link}
          />
        }
        header={
          <Link
            href={orgId ? `/org/${orgId}/dashboard` : "/"}
            aria-label="Klorad"
            style={{ textDecoration: "none", display: "flex", alignItems: "center" }}
          >
            <Image
              src="/images/logo/klorad-campus-logo-white.svg"
              alt="Klorad Campus"
              width={140}
              height={32}
              priority
              style={{
                objectFit: "contain",
                height: "auto",
              }}
            />
          </Link>
        }
        footer={
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
      />

      <Box component="main" sx={{ minHeight: "100vh" }}>
        {children}
      </Box>
    </>
  );
}
