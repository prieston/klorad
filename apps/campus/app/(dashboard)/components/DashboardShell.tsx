"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  AppBar,
  Typography,
  IconButton,
  Avatar,
  Tooltip,
  Divider,
} from "@mui/material";
import MapIcon from "@mui/icons-material/Map";
import MenuIcon from "@mui/icons-material/Menu";
import LogoutIcon from "@mui/icons-material/Logout";
import { signOut, useSession } from "next-auth/react";

const DRAWER_WIDTH = 220;

const NAV_ITEMS = [
  { label: "Maps", icon: <MapIcon fontSize="small" />, path: "/maps" },
];

export default function DashboardShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: session } = useSession();
  const params = useParams<{ orgId: string }>();
  const pathname = usePathname();
  const router = useRouter();

  const orgId = params?.orgId ?? "";
  const base = orgId ? `/org/${orgId}` : "";

  const drawerContent = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Toolbar sx={{ px: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ color: "#3b82f6" }}>
          Campus Maps
        </Typography>
      </Toolbar>
      <Divider sx={{ borderColor: "rgba(255,255,255,0.06)" }} />
      <List dense sx={{ flex: 1, pt: 1 }}>
        {NAV_ITEMS.map(({ label, icon, path }) => {
          const href = `${base}${path}`;
          const active = pathname === href || (path !== "" && pathname.startsWith(href));
          return (
            <ListItemButton
              key={label}
              selected={active}
              onClick={() => { router.push(href); setMobileOpen(false); }}
              sx={{
                mx: 1,
                borderRadius: 1,
                mb: 0.25,
                "&.Mui-selected": {
                  backgroundColor: "rgba(59,130,246,0.12)",
                  "& .MuiListItemIcon-root": { color: "#3b82f6" },
                  "& .MuiListItemText-primary": { color: "#3b82f6", fontWeight: 600 },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>{icon}</ListItemIcon>
              <ListItemText primary={label} primaryTypographyProps={{ fontSize: "0.875rem" }} />
            </ListItemButton>
          );
        })}
      </List>
      <Divider sx={{ borderColor: "rgba(255,255,255,0.06)" }} />
      <Box sx={{ p: 1.5 }}>
        <ListItemButton
          onClick={() => signOut({ callbackUrl: "/auth/signin" })}
          sx={{ borderRadius: 1 }}
        >
          <ListItemIcon sx={{ minWidth: 36 }}><LogoutIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Sign out" primaryTypographyProps={{ fontSize: "0.875rem" }} />
        </ListItemButton>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
          bgcolor: "#0a0d10",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <Toolbar sx={{ gap: 1 }}>
          <IconButton
            edge="start"
            onClick={() => setMobileOpen(true)}
            sx={{ display: { md: "none" } }}
          >
            <MenuIcon />
          </IconButton>
          <Box sx={{ flex: 1 }} />
          <Tooltip title={session?.user?.email ?? ""}>
            <Avatar
              src={session?.user?.image ?? undefined}
              sx={{ width: 32, height: 32, cursor: "pointer" }}
            />
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": {
              width: DRAWER_WIDTH,
              bgcolor: "#0d1117",
              borderRight: "1px solid rgba(255,255,255,0.06)",
            },
          }}
        >
          {drawerContent}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": {
              width: DRAWER_WIDTH,
              bgcolor: "#0d1117",
              borderRight: "1px solid rgba(255,255,255,0.06)",
            },
          }}
          open
        >
          {drawerContent}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flex: 1,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          minHeight: "100vh",
          bgcolor: "#0a0d10",
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}
