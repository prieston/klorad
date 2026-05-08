"use client";

import React, { useMemo, useState } from "react";
import {
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  alpha,
  useTheme,
} from "@mui/material";
import { LeftPanelContainer } from "../panels";
import { ExpandMoreIcon } from "../icons/Icons";

/**
 * Default link — a plain anchor. Apps using Next.js can pass a
 * `linkComponent={Link}` prop to get client-side navigation.
 */
type LinkLike = React.ComponentType<{
  href: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}>;

const DefaultLink: LinkLike = ({ href, children, style }) => (
  <a href={href} style={style}>{children}</a>
);

export interface AppSidebarSubItem {
  label: string;
  path: string;
  comingSoon?: boolean;
}

export interface AppSidebarNavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
  subItems?: AppSidebarSubItem[];
}

export interface AppSidebarProps {
  /** Current pathname from next/navigation usePathname() */
  pathname: string | null;
  /** Top-level menu items rendered as the main nav. */
  navItems: AppSidebarNavItem[];
  /** Slot above the nav list (e.g. brand logo). ~64px tall recommended. */
  header?: React.ReactNode;
  /** Slot rendered between the header and the nav list (e.g. an org switcher). */
  preNav?: React.ReactNode;
  /** Slot below the nav list (e.g. user account menu). */
  footer?: React.ReactNode;
  /**
   * Optional base prefix applied to every nav path (e.g. "/org/abc123").
   * Useful for multi-tenant apps where routes are scoped under an org id.
   */
  pathPrefix?: string;
  /**
   * Component used to render navigation links. Defaults to a plain
   * anchor; Next.js consumers should pass `next/link` for SPA routing.
   */
  linkComponent?: React.ComponentType<{
    href: string;
    children: React.ReactNode;
    style?: React.CSSProperties;
  }>;
}

/**
 * Klorad's universal dashboard sidebar — glass-effect left panel with
 * configurable nav items, optional sub-item accordions, and slotted
 * header/footer. Presentational only: wire up auth, org data, etc. at
 * the app level and pass items/slots in.
 */
export const AppSidebar: React.FC<AppSidebarProps> = ({
  pathname,
  navItems,
  header,
  preNav,
  footer,
  pathPrefix = "",
  linkComponent: Link = DefaultLink,
}) => {
  const theme = useTheme();

  const buildPath = useMemo(() => {
    return (path: string) => {
      if (!pathPrefix) return path;
      const clean = path.startsWith("/") ? path : `/${path}`;
      return `${pathPrefix}${clean}`;
    };
  }, [pathPrefix]);

  const initialExpansion = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const item of navItems) {
      if (!item.subItems) continue;
      map[item.label] =
        pathname?.startsWith(buildPath(item.path)) ?? false;
    }
    return map;
  }, [navItems, pathname, buildPath]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>(initialExpansion);

  const isItemActive = (item: AppSidebarNavItem) => {
    const full = buildPath(item.path);
    if (item.subItems) {
      return item.subItems.some((s) => pathname === buildPath(s.path));
    }
    return pathname === full || pathname === `${full}/`;
  };

  const isSubItemActive = (subPath: string) => pathname === buildPath(subPath);

  return (
    <LeftPanelContainer
      previewMode={false}
      className="glass-panel"
      sx={{
        height: "calc(100vh - 32px)",
        maxHeight: "calc(100vh - 32px)",
        display: "flex",
        flexDirection: "column",
        position: "fixed",
        left: "16px",
        top: "16px",
      }}
    >
      {header && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            height: 64,
            borderBottom: "1px solid rgba(100, 116, 139, 0.2)",
            px: 2,
            flexShrink: 0,
          }}
        >
          {header}
        </Box>
      )}

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          backgroundColor:
            theme.palette.mode === "dark"
              ? "#14171A"
              : "rgba(248, 250, 252, 0.6)",
        }}
      >
        {preNav && <Box sx={{ flexShrink: 0 }}>{preNav}</Box>}
        <List
          sx={{
            width: "100%",
            p: 0,
            overflow: "auto",
            "&::-webkit-scrollbar": { width: 8 },
            "&::-webkit-scrollbar-track": {
              background:
                theme.palette.mode === "dark"
                  ? alpha(theme.palette.primary.main, 0.08)
                  : "rgba(95, 136, 199, 0.05)",
              borderRadius: 4,
              margin: "4px 0",
            },
            "&::-webkit-scrollbar-thumb": {
              background:
                theme.palette.mode === "dark"
                  ? alpha(theme.palette.primary.main, 0.24)
                  : "rgba(95, 136, 199, 0.2)",
              borderRadius: 4,
              border: "2px solid transparent",
              backgroundClip: "padding-box",
            },
          }}
        >
          {navItems.map((item) => {
            const active = isItemActive(item);
            const fullPath = buildPath(item.path);

            if (item.subItems && item.subItems.length > 0) {
              return (
                <Accordion
                  key={item.label}
                  expanded={expanded[item.label] ?? false}
                  onChange={(_e, v) =>
                    setExpanded((prev) => ({ ...prev, [item.label]: v }))
                  }
                  sx={{
                    boxShadow: "none",
                    backgroundColor: "transparent",
                    "&:before": { display: "none" },
                    "&.Mui-expanded": { margin: 0 },
                  }}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    sx={{
                      minHeight: 48,
                      px: 2,
                      py: 1.5,
                      borderBottom: "1px solid rgba(255,255,255,0.08)",
                      color: active ? theme.palette.primary.main : "inherit",
                      "&.Mui-expanded": { minHeight: 48, borderBottom: "none" },
                      "& .MuiAccordionSummary-content": {
                        margin: 0,
                        alignItems: "center",
                        gap: 1,
                        "&.Mui-expanded": { margin: 0 },
                      },
                      "&:hover": {
                        backgroundColor: alpha(theme.palette.primary.main, 0.08),
                        color: theme.palette.primary.main,
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 32, color: "inherit" }}>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{ fontSize: "0.875rem", fontWeight: active ? 600 : 500 }}
                    />
                  </AccordionSummary>
                  <AccordionDetails sx={{ p: 0 }}>
                    {item.subItems.map((sub) => {
                      const subActive = isSubItemActive(sub.path);
                      const content = (
                        <ListItemButton
                          key={sub.path}
                          disabled={sub.comingSoon}
                          sx={{
                            pl: 6,
                            py: 1,
                            color: subActive ? theme.palette.primary.main : "inherit",
                            backgroundColor: subActive
                              ? alpha(theme.palette.primary.main, 0.1)
                              : "transparent",
                            "&:hover": {
                              backgroundColor: alpha(theme.palette.primary.main, 0.08),
                              color: theme.palette.primary.main,
                            },
                          }}
                        >
                          <ListItemText
                            primary={sub.label}
                            primaryTypographyProps={{
                              fontSize: "0.8125rem",
                              fontWeight: subActive ? 600 : 400,
                            }}
                          />
                          {sub.comingSoon && (
                            <Chip
                              label="Soon"
                              size="small"
                              sx={{ fontSize: "0.625rem", height: 18, ml: 1 }}
                            />
                          )}
                        </ListItemButton>
                      );
                      return sub.comingSoon ? (
                        <React.Fragment key={sub.path}>{content}</React.Fragment>
                      ) : (
                        <Link
                          key={sub.path}
                          href={buildPath(sub.path)}
                          style={{ textDecoration: "none", color: "inherit" }}
                        >
                          {content}
                        </Link>
                      );
                    })}
                  </AccordionDetails>
                </Accordion>
              );
            }

            return (
              <Link
                key={item.label}
                href={fullPath}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <ListItemButton
                  sx={{
                    minHeight: 48,
                    px: 2,
                    py: 1.5,
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                    color: active ? theme.palette.primary.main : "inherit",
                    backgroundColor: active
                      ? alpha(theme.palette.primary.main, 0.1)
                      : "transparent",
                    "&:hover": {
                      backgroundColor: alpha(theme.palette.primary.main, 0.08),
                      color: theme.palette.primary.main,
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 32, color: "inherit" }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{ fontSize: "0.875rem", fontWeight: active ? 600 : 500 }}
                  />
                </ListItemButton>
              </Link>
            );
          })}
        </List>
      </Box>

      {footer && (
        <Box
          sx={{
            borderTop: "1px solid rgba(100, 116, 139, 0.2)",
            flexShrink: 0,
          }}
        >
          {footer}
        </Box>
      )}
    </LeftPanelContainer>
  );
};
