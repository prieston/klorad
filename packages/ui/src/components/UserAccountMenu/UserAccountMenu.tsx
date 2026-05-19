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
  useTheme,
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
 *
 * Shares its shell (rounded bordered card, transparent accordion,
 * divider-on-expand) with `OrganizationSwitcher` so the two sidebar
 * controls read as the same element.
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
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const userName = name || email || "User";
  const initial = useMemo(
    () => (name?.charAt(0) || email?.charAt(0) || "U").toUpperCase(),
    [name, email]
  );

  return (
    <Box
      className={className}
      sx={{
        width: "100%",
        minWidth: 0,
        overflow: "hidden",
        borderRadius: 1,
        border: `1px solid ${theme.palette.divider}`,
      }}
    >
      <Accordion
        expanded={expanded}
        onChange={(_e, v) => setExpanded(v)}
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
            minHeight: 56,
            px: 1.5,
            py: 1.5,
            "&.Mui-expanded": {
              minHeight: 56,
              borderBottom: `1px solid ${theme.palette.divider}`,
            },
            "& .MuiAccordionSummary-content": {
              margin: 0,
              minWidth: 0,
              alignItems: "center",
              "&.Mui-expanded": { margin: 0 },
            },
            "&:hover": {
              backgroundColor: alpha(theme.palette.primary.main, 0.08),
              color: theme.palette.primary.main,
            },
            transition: "background-color 0.15s ease, color 0.15s ease",
          }}
        >
          <Avatar
            src={image ?? undefined}
            alt={userName}
            sx={{ width: 32, height: 32, mr: 1.5, fontSize: "0.875rem" }}
          >
            {initial}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box
              sx={{
                fontSize: "0.875rem",
                fontWeight: 600,
                letterSpacing: "0.01em",
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
                  fontSize: "0.7rem",
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
        </AccordionSummary>
        <AccordionDetails sx={{ p: 0 }}>
          <List component="div" disablePadding>
            <ListItem disablePadding>
              <ListItemButton
                {...(profileHref ? { component: "a", href: profileHref } : {})}
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  onProfile?.();
                }}
                selected={profileActive}
                sx={{
                  pl: 1.5,
                  py: 1.25,
                  minWidth: 0,
                  color: profileActive ? theme.palette.primary.main : "inherit",
                  backgroundColor: profileActive
                    ? alpha(theme.palette.primary.main, 0.18)
                    : "transparent",
                  "&.Mui-selected": {
                    backgroundColor: alpha(theme.palette.primary.main, 0.18),
                    color: theme.palette.primary.main,
                    "&:hover": {
                      backgroundColor: alpha(theme.palette.primary.main, 0.24),
                    },
                  },
                  "&:hover": {
                    backgroundColor: alpha(theme.palette.primary.main, 0.08),
                    color: theme.palette.primary.main,
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: "inherit" }}>
                  <PersonIcon sx={{ fontSize: "1.25rem" }} />
                </ListItemIcon>
                <ListItemText
                  primary="Profile"
                  primaryTypographyProps={{
                    fontSize: "0.8125rem",
                    fontWeight: profileActive ? 600 : 400,
                    noWrap: true,
                  }}
                />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton
                onClick={(e) => {
                  e.stopPropagation();
                  onLogout();
                }}
                sx={{
                  pl: 1.5,
                  py: 1.25,
                  minWidth: 0,
                  color: "inherit",
                  "&:hover": {
                    backgroundColor: alpha(theme.palette.error.main, 0.12),
                    color: theme.palette.error.main,
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: "inherit" }}>
                  <LogoutIcon sx={{ fontSize: "1.25rem" }} />
                </ListItemIcon>
                <ListItemText
                  primary="Sign out"
                  primaryTypographyProps={{ fontSize: "0.8125rem", noWrap: true }}
                />
              </ListItemButton>
            </ListItem>
          </List>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
