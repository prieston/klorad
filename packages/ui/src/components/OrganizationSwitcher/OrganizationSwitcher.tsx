"use client";

import React, { useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Skeleton,
  alpha,
  useTheme,
} from "@mui/material";
import { BusinessIcon, ExpandMoreIcon } from "../icons/Icons";

export interface OrganizationSummary {
  id: string;
  name: string;
  slug?: string | null;
  isPersonal?: boolean;
}

type LinkLike = React.ComponentType<{
  href: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
}>;

const DefaultLink: LinkLike = ({ href, children, style, onClick }) => (
  <a href={href} style={style} onClick={onClick}>
    {children}
  </a>
);

export interface OrganizationSwitcherProps {
  organizations: OrganizationSummary[];
  currentOrgId?: string | null;
  /** Current org details — used when the current org is not in the list
   *  (e.g. a personal org that is hidden from the switcher). */
  currentOrganization?: OrganizationSummary | null;
  /** Build an href for a given org id (e.g. `/org/${id}/dashboard`). */
  buildHref: (orgId: string) => string;
  /** When true, the accordion renders collapsed until the user opens it. */
  defaultCollapsed?: boolean;
  /** When true, the summary shows a skeleton placeholder. */
  loading?: boolean;
  /** Next.js Link (or any anchor-like) — defaults to a plain <a>. */
  linkComponent?: LinkLike;
}

/**
 * Klorad's sidebar organization accordion — shows the current org in the
 * summary; expanding reveals a list of other orgs the user can switch to.
 * Presentational — wire up data fetching and routing at the app level.
 */
export function OrganizationSwitcher({
  organizations,
  currentOrgId,
  currentOrganization,
  buildHref,
  defaultCollapsed = true,
  loading = false,
  linkComponent: Link = DefaultLink,
}: OrganizationSwitcherProps) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(!defaultCollapsed);

  const current =
    currentOrganization ??
    organizations.find((o) => o.id === currentOrgId) ??
    null;

  return (
    <Box sx={{ width: "100%" }}>
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
            px: 2,
            py: 1.5,
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            "&.Mui-expanded": { minHeight: 56, borderBottom: "none" },
            "& .MuiAccordionSummary-content": {
              margin: 0,
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
          <ListItemIcon sx={{ minWidth: 40, color: "inherit" }}>
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
                  inset: 0,
                  borderRadius: 1,
                  backgroundColor: "currentColor",
                  opacity: 0.15,
                }}
              />
              <BusinessIcon sx={{ fontSize: "1.25rem", position: "relative", zIndex: 1 }} />
            </Box>
          </ListItemIcon>
          <ListItemText
            primary={
              loading ? (
                <Skeleton variant="text" width={120} height={20} />
              ) : (
                current?.name || "Select organization"
              )
            }
            secondary={!loading && current?.isPersonal ? "(Your Workspace)" : null}
            primaryTypographyProps={{
              fontSize: "0.875rem",
              fontWeight: 600,
              letterSpacing: "0.01em",
              noWrap: true,
            }}
            secondaryTypographyProps={{
              fontSize: "0.7rem",
              color: "text.secondary",
            }}
          />
        </AccordionSummary>
        <AccordionDetails sx={{ p: 0, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <List component="div" disablePadding>
            {organizations.length === 0 && !loading && (
              <ListItem disablePadding>
                <Box sx={{ px: 2, py: 1.5, fontSize: "0.8125rem", color: "text.secondary" }}>
                  No other organizations
                </Box>
              </ListItem>
            )}
            {organizations.map((org) => {
              const isSelected = org.id === currentOrgId;
              return (
                <ListItem key={org.id} disablePadding>
                  <Link
                    href={buildHref(org.id)}
                    style={{ textDecoration: "none", color: "inherit", width: "100%" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ListItemButton
                      selected={isSelected}
                      sx={{
                        pl: 6,
                        py: 1.25,
                        color: isSelected ? theme.palette.primary.main : "inherit",
                        backgroundColor: isSelected
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
                      <ListItemText
                        primary={org.name}
                        secondary={org.isPersonal ? "(Your Workspace)" : null}
                        primaryTypographyProps={{
                          fontSize: "0.8125rem",
                          fontWeight: isSelected ? 600 : 400,
                        }}
                        secondaryTypographyProps={{
                          fontSize: "0.7rem",
                          color: "text.secondary",
                        }}
                      />
                    </ListItemButton>
                  </Link>
                </ListItem>
              );
            })}
          </List>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
