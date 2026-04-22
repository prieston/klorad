"use client";

import type { ReactNode } from "react";
import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Avatar,
  Box,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import MapIcon from "@mui/icons-material/Map";
import { signOut, useSession } from "next-auth/react";
import { AppSidebar } from "@klorad/ui";
import type { AppSidebarNavItem } from "@klorad/ui";

const NAV_ITEMS: AppSidebarNavItem[] = [
  { label: "Maps", icon: <MapIcon fontSize="small" />, path: "/maps" },
];

export default function DashboardShell({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const params = useParams<{ orgId: string }>();
  const pathname = usePathname();
  const orgId = params?.orgId ?? "";
  const pathPrefix = orgId ? `/org/${orgId}` : "";

  // Builder routes have their own dedicated left panel (BuilderLeftPanel),
  // so skip the global sidebar there — mirrors editor behavior.
  const isBuilder = pathname?.includes("/builder") ?? false;

  if (isBuilder) {
    return (
      <Box component="main" sx={{ minHeight: "100vh" }}>
        {children}
      </Box>
    );
  }

  return (
    <>
      <AppSidebar
        pathname={pathname ?? null}
        navItems={NAV_ITEMS}
        pathPrefix={pathPrefix}
        linkComponent={Link}
        header={
          <Typography variant="subtitle1" fontWeight={700} color="primary">
            Campus Maps
          </Typography>
        }
        footer={
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              px: 2,
              py: 1.5,
            }}
          >
            <Tooltip title={session?.user?.email ?? ""}>
              <Avatar
                src={session?.user?.image ?? undefined}
                sx={{ width: 28, height: 28 }}
              />
            </Tooltip>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" noWrap>
                {session?.user?.name ?? session?.user?.email}
              </Typography>
            </Box>
            <Tooltip title="Sign out">
              <IconButton
                size="small"
                onClick={() => signOut({ callbackUrl: "/auth/signin" })}
              >
                <LogoutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        }
      />

      <Box component="main" sx={{ minHeight: "100vh" }}>
        {children}
      </Box>
    </>
  );
}
