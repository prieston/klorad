"use client";

import React, { useState, useMemo } from "react";
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Divider,
  Skeleton,
  alpha,
  useTheme,
} from "@mui/material";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  BusinessIcon,
  DashboardIcon,
  ExpandMoreIcon,
  FolderIcon,
  HelpOutlineIcon,
  LeftPanelContainer,
  LibraryBooksIcon,
  SettingsIcon,
} from "@klorad/ui";
import LogoHeader from "@/app/components/AppBar/LogoHeader";
import UserAccountMenu from "@/app/components/AppBar/UserAccountMenu";
import useOrganization from "@/app/hooks/useOrganization";
import useOrganizations from "@/app/hooks/useOrganizations";
import { useOrgId } from "@/app/hooks/useOrgId";

interface SubMenuItem {
  label: string;
  path: string;
  comingSoon?: boolean;
}

interface MenuItem {
  label: string;
  icon: React.ReactNode;
  path: string;
  subItems?: SubMenuItem[];
}

const menuItems: MenuItem[] = [
  {
    label: "Dashboard",
    icon: <DashboardIcon />,
    path: "/dashboard",
  },
  {
    label: "Projects",
    icon: <FolderIcon />,
    path: "/projects",
  },
  {
    label: "Library",
    icon: <LibraryBooksIcon />,
    path: "/library",
    subItems: [
      { label: "Models", path: "/library/models" },
      { label: "Geospatial Assets", path: "/library/geospatial" },
      { label: "Sensors", path: "/library/sensors", comingSoon: true },
      {
        label: "Data Sources",
        path: "/library/data-sources",
        comingSoon: true,
      },
    ],
  },
  {
    label: "Settings",
    icon: <SettingsIcon />,
    path: "/settings",
    subItems: [
      { label: "General", path: "/settings/general" },
      { label: "Members", path: "/settings/members" },
      { label: "Usage", path: "/settings/usage" },
      { label: "Activity", path: "/settings/activity" },
      { label: "Integrations", path: "/settings/integrations" },
    ],
  },
  {
    label: "Support",
    icon: <HelpOutlineIcon />,
    path: "/support",
  },
];

const DashboardSidebar: React.FC = () => {
  const pathname = usePathname();
  const theme = useTheme();
  const orgId = useOrgId();
  const { organization: currentOrganization, loadingOrganization } =
    useOrganization(orgId);
  const { organizations, loadingOrganizations } = useOrganizations();

  // Build paths with orgId prefix
  const buildPath = useMemo(() => {
    return (path: string) => {
      if (!orgId) return path;
      // Remove leading slash and build new path
      const cleanPath = path.startsWith("/") ? path.slice(1) : path;
      return `/org/${orgId}/${cleanPath}`;
    };
  }, [orgId]);

  // Track manual expansion state (user clicks) - null means no manual interaction yet
  const [manuallyExpanded, setManuallyExpanded] = useState<
    Record<string, boolean | null>
  >({
    organization: null,
    library: null,
    settings: null,
  });

  // Calculate which accordions should be expanded based on pathname
  const pathnameExpanded = useMemo(() => {
    const orgPrefix = orgId ? `/org/${orgId}` : "";
    return {
      organization: false, // Organization switcher doesn't expand based on pathname
      library: pathname?.startsWith(`${orgPrefix}/library/`) || false,
      settings: pathname?.startsWith(`${orgPrefix}/settings/`) || false,
    };
  }, [pathname, orgId]);

  // Combine pathname-based expansion with manual expansion
  // Manual expansion/collapse takes precedence, pathname expansion only applies if no manual interaction
  const expandedGroups = useMemo(() => {
    return {
      organization:
        manuallyExpanded.organization !== null
          ? manuallyExpanded.organization
          : pathnameExpanded.organization,
      library:
        manuallyExpanded.library !== null
          ? manuallyExpanded.library
          : pathnameExpanded.library,
      settings:
        manuallyExpanded.settings !== null
          ? manuallyExpanded.settings
          : pathnameExpanded.settings,
    };
  }, [manuallyExpanded, pathnameExpanded]);

  const isItemActive = (item: MenuItem) => {
    const itemPath = buildPath(item.path);
    if (item.subItems) {
      // For groups, check if any subpage is active
      return item.subItems.some((subItem) => {
        const subPath = buildPath(subItem.path);
        return pathname === subPath;
      });
    }
    return pathname === itemPath || pathname === `${itemPath}/`;
  };

  const isSubItemActive = (subPath: string) => {
    const fullPath = buildPath(subPath);
    return pathname === fullPath;
  };

  // Hide sidebar on builder pages (but keep component mounted to maintain hook order)
  const isBuilderPage = pathname?.includes("/builder");
  if (isBuilderPage) {
    return null;
  }

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
      {/* Logo Header - Fixed at top */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          height: "64px",
          borderBottom: "1px solid rgba(100, 116, 139, 0.2)",
          px: 2,
          flexShrink: 0,
        }}
      >
        <LogoHeader />
      </Box>

      {/* Menu Items - Takes remaining space */}
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
        <List
          sx={{
            width: "100%",
            p: 0,
            overflow: "auto",
            "&::-webkit-scrollbar": {
              width: "8px",
            },
            "&::-webkit-scrollbar-track": {
              background:
                theme.palette.mode === "dark"
                  ? alpha(theme.palette.primary.main, 0.08)
                  : "rgba(95, 136, 199, 0.05)",
              borderRadius: "4px",
              margin: "4px 0",
            },
            "&::-webkit-scrollbar-thumb": {
              background:
                theme.palette.mode === "dark"
                  ? alpha(theme.palette.primary.main, 0.24)
                  : "rgba(95, 136, 199, 0.2)",
              borderRadius: "4px",
              border: "2px solid transparent",
              backgroundClip: "padding-box",
              transition: "background 0.2s ease",
              "&:hover": {
                background:
                  theme.palette.mode === "dark"
                    ? alpha(theme.palette.primary.main, 0.38)
                    : "rgba(95, 136, 199, 0.35)",
                backgroundClip: "padding-box",
              },
            },
          }}
        >
          {/* Organization Switcher */}
          {((currentOrganization && organizations.length > 0) ||
            loadingOrganization ||
            loadingOrganizations) && (
            <Box sx={{ marginBottom: 4 }}>
              <Accordion
                expanded={expandedGroups.organization}
                onChange={(_event, newExpanded) => {
                  setManuallyExpanded((prev) => ({
                    ...prev,
                    organization: newExpanded,
                  }));
                }}
                sx={{
                  marginBottom: 0,
                  boxShadow: "none",
                  "&:before": {
                    display: "none",
                  },
                  "&.Mui-expanded": {
                    margin: 0,
                  },
                  backgroundColor: "transparent",
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  sx={{
                    backgroundColor:
                      theme.palette.mode === "dark"
                        ? theme.palette.background.paper
                        : "rgba(248, 250, 252, 0.6)",
                    borderRadius: 0,
                    minHeight: "48px",
                    padding: theme.spacing(1.5, 2),
                    borderBottom: "1px solid",
                    borderColor: "rgba(255, 255, 255, 0.08)",
                    "&.Mui-expanded": {
                      minHeight: "48px",
                      borderBottom: "none",
                    },
                    "&:hover": {
                      backgroundColor:
                        theme.palette.mode === "dark"
                          ? alpha(theme.palette.primary.main, 0.1)
                          : "rgba(248, 250, 252, 0.9)",
                      color: theme.palette.primary.main,
                    },
                    "& .MuiAccordionSummary-content": {
                      margin: 0,
                      "&.Mui-expanded": {
                        margin: 0,
                      },
                    },
                    transition: "background-color 0.15s ease, color 0.15s ease",
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      width: "100%",
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 40,
                        color: "inherit",
                        mr: 1,
                        position: "relative",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-start",
                      }}
                    >
                      <Box
                        sx={{
                          position: "relative",
                          width: 32,
                          height: 28,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Box
                          sx={{
                            position: "absolute",
                            width: "100%",
                            height: "100%",
                            borderRadius: "4px",
                            backgroundColor: "currentColor",
                            opacity: 0.15,
                          }}
                        />
                        <BusinessIcon
                          sx={{
                            fontSize: "1.25rem",
                            color: "inherit",
                            position: "relative",
                            zIndex: 1,
                          }}
                        />
                      </Box>
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        loadingOrganization || loadingOrganizations ? (
                          <Skeleton
                            variant="text"
                            width={120}
                            height={20}
                            sx={{
                              bgcolor: alpha(theme.palette.primary.main, 0.1),
                            }}
                          />
                        ) : (
                          currentOrganization?.name || ""
                        )
                      }
                      secondary={
                        !loadingOrganization &&
                        !loadingOrganizations &&
                        currentOrganization?.isPersonal
                          ? "(Your Workspace)"
                          : null
                      }
                      primaryTypographyProps={{
                        fontSize: "0.875rem",
                        fontWeight: 500,
                        letterSpacing: "0.01em",
                      }}
                      secondaryTypographyProps={{
                        fontSize: "0.75rem",
                        color: "text.secondary",
                      }}
                    />
                  </Box>
                </AccordionSummary>
                <AccordionDetails
                  sx={{
                    padding: 0,
                    backgroundColor: "transparent",
                    borderBottom: "1px solid",
                    borderColor: "rgba(255, 255, 255, 0.08)",
                  }}
                >
                  <List component="div" disablePadding>
                    {organizations.map((org) => {
                      const isSelected = org.id === orgId;
                      return (
                        <ListItem key={org.id} disablePadding>
                          <ListItemButton
                            component={Link}
                            href={`/org/${org.id}/dashboard`}
                            selected={isSelected}
                            disableRipple
                            onClick={(e) => {
                              e.stopPropagation();
                              // Organization switching happens via navigation
                            }}
                            sx={(theme) => ({
                              pl: 6,
                              borderRadius: 0,
                              marginBottom: 0,
                              padding: theme.spacing(1.5, 2),
                              backgroundColor: isSelected
                                ? alpha(theme.palette.primary.main, 0.18)
                                : theme.palette.mode === "dark"
                                  ? theme.palette.background.paper
                                  : "rgba(248, 250, 252, 0.6)",
                              color: isSelected
                                ? theme.palette.primary.main
                                : theme.palette.mode === "dark"
                                  ? theme.palette.text.primary
                                  : "rgba(51, 65, 85, 0.95)",
                              transition:
                                "background-color 0.15s ease, color 0.15s ease",
                              "&.Mui-selected": {
                                backgroundColor: alpha(
                                  theme.palette.primary.main,
                                  0.18
                                ),
                                color: theme.palette.primary.main,
                                "&:hover": {
                                  backgroundColor: alpha(
                                    theme.palette.primary.main,
                                    0.24
                                  ),
                                },
                              },
                              "&:hover": {
                                backgroundColor: isSelected
                                  ? alpha(theme.palette.primary.main, 0.24)
                                  : theme.palette.mode === "dark"
                                    ? alpha(theme.palette.primary.main, 0.1)
                                    : "rgba(248, 250, 252, 0.9)",
                                color: theme.palette.primary.main,
                              },
                            })}
                          >
                            <ListItemText
                              primary={org.name}
                              secondary={
                                org.isPersonal ? "(Your Workspace)" : null
                              }
                              primaryTypographyProps={{
                                fontSize: "0.875rem",
                                fontWeight: isSelected ? 600 : 400,
                                letterSpacing: "0.01em",
                              }}
                              secondaryTypographyProps={{
                                fontSize: "0.75rem",
                                color: "text.secondary",
                                fontStyle: "italic",
                              }}
                            />
                          </ListItemButton>
                        </ListItem>
                      );
                    })}
                  </List>
                </AccordionDetails>
              </Accordion>
            </Box>
          )}

          {menuItems.map((item) => {
            const isActive = isItemActive(item);
            const groupKey = item.label.toLowerCase();
            const isExpanded = expandedGroups[groupKey] || false;
            const hasSubItems = item.subItems && item.subItems.length > 0;

            // Use Accordion for items with sub-items, regular ListItemButton for single items
            if (hasSubItems) {
              return (
                <Box key={item.path} sx={{ marginBottom: 0 }}>
                  <Accordion
                    expanded={isExpanded}
                    onChange={(_event, newExpanded) => {
                      // Update manual expansion state
                      setManuallyExpanded((prev) => ({
                        ...prev,
                        [groupKey]: newExpanded,
                      }));
                    }}
                    sx={{
                      marginBottom: 0,
                      boxShadow: "none",
                      "&:before": {
                        display: "none",
                      },
                      "&.Mui-expanded": {
                        margin: 0,
                      },
                      backgroundColor: "transparent",
                    }}
                  >
                    <AccordionSummary
                      expandIcon={<ExpandMoreIcon />}
                      sx={{
                        backgroundColor:
                          theme.palette.mode === "dark"
                            ? theme.palette.background.paper
                            : "rgba(248, 250, 252, 0.6)",
                        borderRadius: 0,
                        minHeight: "48px",
                        padding: theme.spacing(1.5, 2),
                        borderBottom: "1px solid",
                        borderColor: "rgba(255, 255, 255, 0.08)",
                        "&.Mui-expanded": {
                          minHeight: "48px",
                          borderBottom: "none",
                        },
                        "&:hover": {
                          backgroundColor:
                            theme.palette.mode === "dark"
                              ? alpha(theme.palette.primary.main, 0.1)
                              : "rgba(248, 250, 252, 0.9)",
                          color: theme.palette.primary.main,
                        },
                        "& .MuiAccordionSummary-content": {
                          margin: 0,
                          "&.Mui-expanded": {
                            margin: 0,
                          },
                        },
                        transition:
                          "background-color 0.15s ease, color 0.15s ease",
                      }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          width: "100%",
                        }}
                      >
                        <ListItemIcon
                          sx={{
                            minWidth: 40,
                            color: "inherit",
                            mr: 1,
                          }}
                        >
                          {item.icon}
                        </ListItemIcon>
                        <ListItemText
                          primary={item.label}
                          primaryTypographyProps={{
                            fontSize: "0.875rem",
                            fontWeight: 400,
                            letterSpacing: "0.01em",
                          }}
                        />
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails
                      sx={{
                        padding: 0,
                        backgroundColor: "transparent",
                        borderBottom: "1px solid",
                        borderColor: "rgba(255, 255, 255, 0.08)",
                      }}
                    >
                      <List component="div" disablePadding>
                        {item.subItems?.map((subItem) => {
                          const isSubActive = isSubItemActive(subItem.path);
                          return (
                            <ListItem key={subItem.path} disablePadding>
                              <ListItemButton
                                component={subItem.comingSoon ? Box : Link}
                                href={
                                  subItem.comingSoon
                                    ? undefined
                                    : buildPath(subItem.path)
                                }
                                selected={isSubActive}
                                disableRipple
                                disabled={subItem.comingSoon}
                                onClick={(e) => {
                                  // Stop propagation to prevent Accordion from toggling
                                  e.stopPropagation();
                                  // Prevent navigation if coming soon
                                  if (subItem.comingSoon) {
                                    e.preventDefault();
                                  }
                                }}
                                sx={(theme) => ({
                                  pl: 6,
                                  borderRadius: 0,
                                  marginBottom: 0,
                                  padding: theme.spacing(1.5, 2),
                                  backgroundColor: isSubActive
                                    ? alpha(theme.palette.primary.main, 0.18)
                                    : theme.palette.mode === "dark"
                                      ? theme.palette.background.paper
                                      : "rgba(248, 250, 252, 0.6)",
                                  color: isSubActive
                                    ? theme.palette.primary.main
                                    : theme.palette.mode === "dark"
                                      ? theme.palette.text.primary
                                      : "rgba(51, 65, 85, 0.95)",
                                  opacity: subItem.comingSoon ? 0.5 : 1,
                                  cursor: subItem.comingSoon
                                    ? "not-allowed"
                                    : "pointer",
                                  transition:
                                    "background-color 0.15s ease, color 0.15s ease",
                                  "&.Mui-selected": {
                                    backgroundColor: alpha(
                                      theme.palette.primary.main,
                                      0.18
                                    ),
                                    color: theme.palette.primary.main,
                                    "&:hover": {
                                      backgroundColor: alpha(
                                        theme.palette.primary.main,
                                        0.24
                                      ),
                                    },
                                  },
                                  "&:hover": {
                                    backgroundColor: subItem.comingSoon
                                      ? undefined
                                      : isSubActive
                                        ? alpha(
                                            theme.palette.primary.main,
                                            0.24
                                          )
                                        : theme.palette.mode === "dark"
                                          ? alpha(
                                              theme.palette.primary.main,
                                              0.1
                                            )
                                          : "rgba(248, 250, 252, 0.9)",
                                    color: subItem.comingSoon
                                      ? undefined
                                      : theme.palette.primary.main,
                                  },
                                  "&.Mui-disabled": {
                                    opacity: 0.5,
                                  },
                                })}
                              >
                                <ListItemText
                                  primary={subItem.label}
                                  primaryTypographyProps={{
                                    fontSize: "0.875rem",
                                    fontWeight: isSubActive ? 600 : 400,
                                    letterSpacing: "0.01em",
                                  }}
                                />
                                {subItem.comingSoon && (
                                  <Chip
                                    label="Coming Soon"
                                    size="small"
                                    sx={{
                                      ml: 1,
                                      backgroundColor: alpha("#6366f1", 0.15),
                                      color: "#6366f1",
                                      border: "1px solid",
                                      borderColor: alpha("#6366f1", 0.4),
                                      fontSize: "0.7rem",
                                      height: 20,
                                      fontWeight: 500,
                                      "& .MuiChip-label": { px: 1 },
                                    }}
                                  />
                                )}
                              </ListItemButton>
                            </ListItem>
                          );
                        })}
                      </List>
                    </AccordionDetails>
                  </Accordion>
                </Box>
              );
            }

            // Regular menu item without sub-items
            return (
              <ListItem key={item.path} disablePadding sx={{ marginBottom: 0 }}>
                <ListItemButton
                  component={Link}
                  href={buildPath(item.path)}
                  selected={isActive}
                  disableRipple
                  sx={(theme) => ({
                    borderRadius: 0,
                    marginBottom: 0,
                    padding: theme.spacing(1.5, 2),
                    backgroundColor: isActive
                      ? alpha(theme.palette.primary.main, 0.18)
                      : theme.palette.mode === "dark"
                        ? theme.palette.background.paper
                        : "rgba(248, 250, 252, 0.6)",
                    color: isActive
                      ? theme.palette.primary.main
                      : theme.palette.mode === "dark"
                        ? theme.palette.text.primary
                        : "rgba(51, 65, 85, 0.95)",
                    borderBottom: "1px solid",
                    borderColor: "rgba(255, 255, 255, 0.08)",
                    transition: "background-color 0.15s ease, color 0.15s ease",
                    "&.Mui-selected": {
                      backgroundColor: alpha(theme.palette.primary.main, 0.18),
                      color: theme.palette.primary.main,
                      "&:hover": {
                        backgroundColor: alpha(
                          theme.palette.primary.main,
                          0.24
                        ),
                      },
                    },
                    "&:hover": {
                      backgroundColor: isActive
                        ? alpha(theme.palette.primary.main, 0.24)
                        : theme.palette.mode === "dark"
                          ? alpha(theme.palette.primary.main, 0.1)
                          : "rgba(248, 250, 252, 0.9)",
                      color: theme.palette.primary.main,
                    },
                  })}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 40,
                      color: "inherit",
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{
                      fontSize: "0.875rem",
                      fontWeight: isActive ? 600 : 400,
                      letterSpacing: "0.01em",
                    }}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Box>

      {/* Divider above user account menu */}
      <Divider
        sx={{
          borderColor: "rgba(255, 255, 255, 0.08)",
          mt: 2,
          mb: 2,
        }}
      />

      {/* User Account Menu - Fixed at bottom */}
      <Box
        sx={{
          py: 0,
          px: 0,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          width: "100%",
        }}
      >
        <Box sx={{ width: "100%" }}>
          <UserAccountMenu />
        </Box>
      </Box>

    </LeftPanelContainer>
  );
};

export default DashboardSidebar;
