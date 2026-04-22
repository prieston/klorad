"use client";

import React, { useMemo, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Avatar,
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  alpha,
} from "@mui/material";
import { ExpandMoreIcon, LogoutIcon, PersonIcon } from "../icons/Icons";

export interface UserAccountMenuProps {
  /** Display name; falls back to email if missing. */
  name?: string | null;
  /** Email address (shown as subtitle if both name and email exist). */
  email?: string | null;
  /** Avatar image URL (optional). */
  image?: string | null;
  /** Profile link href — the Profile row becomes a regular <a>. */
  profileHref?: string;
  /** Called when Profile is clicked. Runs after navigation. */
  onProfile?: () => void;
  /** Called when Logout is clicked. */
  onLogout: () => void;
  /** Highlight the Profile row as the active page. */
  profileActive?: boolean;
  className?: string;
}

/**
 * Klorad's sidebar footer user menu. Renders an avatar + name + email
 * inside an accordion summary. Expanding reveals Profile and Logout
 * rows. Presentational — pass a session in, wire navigation / logout
 * handlers from the calling app.
 */
export function UserAccountMenu({
  name,
  email,
  image,
  profileHref,
  onProfile,
  onLogout,
  profileActive = false,
  className,
}: UserAccountMenuProps) {
  const [expanded, setExpanded] = useState(false);
  const userName = name || email || "User";
  const initial = useMemo(
    () => (name?.charAt(0) || email?.charAt(0) || "U").toUpperCase(),
    [name, email]
  );

  return (
    <Box className={className} sx={{ width: "100%" }}>
      <Accordion
        expanded={expanded}
        onChange={(_e, v) => setExpanded(v)}
        sx={{
          marginBottom: 0,
          boxShadow: "none",
          "&:before": { display: "none" },
          "&.Mui-expanded": { margin: 0 },
          backgroundColor: "transparent",
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          sx={(theme) => ({
            backgroundColor:
              theme.palette.mode === "dark"
                ? theme.palette.background.paper
                : "rgba(248,250,252,0.6)",
            borderRadius: 0,
            minHeight: 48,
            p: theme.spacing(1.5, 2),
            "&.Mui-expanded": { minHeight: 48 },
            "& .MuiAccordionSummary-content": {
              margin: 0,
              "&.Mui-expanded": { margin: 0 },
            },
            "&:hover": {
              backgroundColor: alpha(theme.palette.primary.main, 0.1),
              color: theme.palette.primary.main,
            },
            transition: "background-color 0.15s ease, color 0.15s ease",
          })}
        >
          <Box sx={{ display: "flex", alignItems: "center", width: "100%" }}>
            <Avatar
              src={image ?? undefined}
              alt={userName}
              sx={{ width: 32, height: 32, mr: 1.5 }}
            >
              {initial}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box
                sx={{
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {userName}
              </Box>
              {email && name && (
                <Box
                  sx={{
                    fontSize: "0.75rem",
                    color: "text.secondary",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {email}
                </Box>
              )}
            </Box>
          </Box>
        </AccordionSummary>
        <AccordionDetails
          sx={(t) => ({
            p: 0,
            backgroundColor: "transparent",
            borderBottom: "1px solid",
            borderColor: alpha(t.palette.common.white, 0.08),
          })}
        >
          <List component="div" disablePadding>
            <ListItem disablePadding>
              <ListItemButton
                {...(profileHref ? { component: "a", href: profileHref } : {})}
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  onProfile?.();
                }}
                selected={profileActive}
                sx={(theme) => ({
                  pl: 6,
                  borderRadius: 0,
                  p: theme.spacing(1.5, 2),
                  backgroundColor: profileActive
                    ? alpha(theme.palette.primary.main, 0.18)
                    : theme.palette.background.paper,
                  color: profileActive ? "primary.main" : "text.primary",
                  "&.Mui-selected": {
                    backgroundColor: alpha(theme.palette.primary.main, 0.18),
                    color: theme.palette.primary.main,
                    "&:hover": {
                      backgroundColor: alpha(theme.palette.primary.main, 0.24),
                    },
                  },
                  "&:hover": {
                    backgroundColor: profileActive
                      ? alpha(theme.palette.primary.main, 0.24)
                      : alpha(theme.palette.primary.main, 0.1),
                    color: "primary.main",
                  },
                })}
              >
                <ListItemIcon sx={{ minWidth: 40, color: "inherit" }}>
                  <PersonIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Profile"
                  primaryTypographyProps={{ fontSize: "0.875rem", fontWeight: profileActive ? 600 : 400 }}
                />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton
                onClick={(e) => {
                  e.stopPropagation();
                  onLogout();
                }}
                sx={(theme) => ({
                  pl: 6,
                  borderRadius: 0,
                  p: theme.spacing(1.5, 2),
                  backgroundColor: theme.palette.background.paper,
                  color: "text.primary",
                  "&:hover": {
                    backgroundColor: alpha(theme.palette.error.main, 0.12),
                    color: theme.palette.error.main,
                  },
                })}
              >
                <ListItemIcon sx={{ minWidth: 40, color: "inherit" }}>
                  <LogoutIcon />
                </ListItemIcon>
                <ListItemText primary="Sign out" primaryTypographyProps={{ fontSize: "0.875rem" }} />
              </ListItemButton>
            </ListItem>
          </List>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
