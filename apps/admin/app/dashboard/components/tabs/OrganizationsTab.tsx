"use client";

import { useState } from "react";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  IconButton,
  alpha,
  CircularProgress,
  Menu,
  MenuItem,
} from "@mui/material";
import {
  PageCard,
  AddIcon,
  PeopleIcon,
  MoreVert,
} from "@klorad/ui";
import useSWR from "swr";
import { KLORAD_APPS } from "../appsConfig";

interface OrganizationsData {
  organizations: {
    total: number;
    personal: number;
    team: number;
    byPlan: Array<{ planCode: string; count: number }>;
    all: Array<{
      id: string;
      name: string;
      slug: string;
      isPersonal: boolean;
      planCode: string;
      subscriptionStatus: string | null;
      apps: string[];
      memberCount: number;
      projectCount: number;
      assetCount: number;
      createdAt: Date;
    }>;
  };
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch organizations");
  return res.json();
};

interface OrganizationsTabProps {
  onCreateClick: () => void;
  onUpgradeClick: (org: { id: string; name: string }) => void;
  onMembersClick: (org: { id: string; name: string; isPersonal: boolean }) => void;
  onLicenseClick: (org: any) => void;
  onAppsClick: (org: { id: string; name: string; apps: string[] }) => void;
  onDeleteClick: (org: { id: string; name: string }) => void;
}

export function OrganizationsTab({
  onCreateClick,
  onUpgradeClick,
  onMembersClick,
  onLicenseClick,
  onAppsClick,
  onDeleteClick,
}: OrganizationsTabProps) {
  const { data, error, isLoading } = useSWR<OrganizationsData>(
    "/api/stats?section=organizations",
    fetcher
  );

  const [menuAnchor, setMenuAnchor] = useState<{
    element: HTMLElement;
    orgId: string;
    orgName: string;
    orgApps: string[];
  } | null>(null);

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={2}>
        <Typography color="error">Failed to load organizations</Typography>
      </Box>
    );
  }

  if (!data?.organizations) return null;

  return (
    <>
      <Box sx={{ mb: 2 }}>
        <PageCard>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mb: 3,
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: "1rem" }}>
              Organizations ({data.organizations.all.length})
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={onCreateClick}
              size="small"
              sx={(theme) => ({
                borderRadius: `${theme.shape.borderRadius}px`,
                textTransform: "none",
                fontWeight: 500,
                fontSize: "0.75rem",
                backgroundColor:
                  theme.palette.mode === "dark"
                    ? "#161B20"
                    : theme.palette.background.paper,
                color: theme.palette.primary.main,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                padding: "6px 16px",
                boxShadow: "none",
                "&:hover": {
                  backgroundColor:
                    theme.palette.mode === "dark"
                      ? "#1a1f26"
                      : alpha(theme.palette.primary.main, 0.05),
                  borderColor: alpha(theme.palette.primary.main, 0.5),
                },
              })}
            >
              Create Organization
            </Button>
          </Box>
          <TableContainer
            component={Box}
            sx={{
              backgroundColor: "transparent",
              boxShadow: "none",
              maxHeight: 600,
            }}
          >
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ backgroundColor: "transparent" }}>
                  <TableCell
                    sx={{
                      fontSize: "0.75rem",
                      color: "text.primary",
                      fontWeight: 600,
                      backgroundColor: "transparent",
                    }}
                  >
                    Name
                  </TableCell>
                  <TableCell
                    sx={{
                      fontSize: "0.75rem",
                      color: "text.primary",
                      fontWeight: 600,
                      backgroundColor: "transparent",
                    }}
                  >
                    Slug
                  </TableCell>
                  <TableCell
                    align="center"
                    sx={{
                      fontSize: "0.75rem",
                      color: "text.primary",
                      fontWeight: 600,
                      backgroundColor: "transparent",
                    }}
                  >
                    Type
                  </TableCell>
                  <TableCell
                    align="center"
                    sx={{
                      fontSize: "0.75rem",
                      color: "text.primary",
                      fontWeight: 600,
                      backgroundColor: "transparent",
                    }}
                  >
                    Plan
                  </TableCell>
                  <TableCell
                    align="center"
                    sx={{
                      fontSize: "0.75rem",
                      color: "text.primary",
                      fontWeight: 600,
                      backgroundColor: "transparent",
                    }}
                  >
                    Status
                  </TableCell>
                  <TableCell
                    align="center"
                    sx={{
                      fontSize: "0.75rem",
                      color: "text.primary",
                      fontWeight: 600,
                      backgroundColor: "transparent",
                    }}
                  >
                    Apps
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      fontSize: "0.75rem",
                      color: "text.primary",
                      fontWeight: 600,
                      backgroundColor: "transparent",
                    }}
                  >
                    Members
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      fontSize: "0.75rem",
                      color: "text.primary",
                      fontWeight: 600,
                      backgroundColor: "transparent",
                    }}
                  >
                    Projects
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      fontSize: "0.75rem",
                      color: "text.primary",
                      fontWeight: 600,
                      backgroundColor: "transparent",
                    }}
                  >
                    Assets
                  </TableCell>
                  <TableCell
                    sx={{
                      fontSize: "0.75rem",
                      color: "text.primary",
                      fontWeight: 600,
                      backgroundColor: "transparent",
                    }}
                  >
                    Created
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      fontSize: "0.75rem",
                      color: "text.primary",
                      fontWeight: 600,
                      backgroundColor: "transparent",
                    }}
                  >
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.organizations.all.map((org) => (
                  <TableRow
                    key={org.id}
                    sx={{
                      backgroundColor: "transparent",
                      "&:hover": { backgroundColor: "transparent" },
                    }}
                  >
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          fontSize: "0.75rem",
                          color: "text.primary",
                        }}
                      >
                        {org.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          fontSize: "0.75rem",
                          color: "text.secondary",
                        }}
                      >
                        {org.slug}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      {org.isPersonal ? (
                        <Chip
                          label="Personal"
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: "0.7rem",
                            backgroundColor: alpha("#6B9CD8", 0.1),
                            color: "#6B9CD8",
                            border: `1px solid ${alpha("#6B9CD8", 0.3)}`,
                          }}
                        />
                      ) : (
                        <Chip
                          label="Team"
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: "0.7rem",
                            backgroundColor: alpha("#6B9CD8", 0.1),
                            color: "#6B9CD8",
                            border: `1px solid ${alpha("#6B9CD8", 0.3)}`,
                          }}
                        />
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={org.planCode}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: "0.7rem",
                          backgroundColor:
                            org.planCode === "free"
                              ? alpha("#6B9CD8", 0.1)
                              : alpha("#22c55e", 0.1),
                          color:
                            org.planCode === "free" ? "#6B9CD8" : "#22c55e",
                          border: `1px solid ${
                            org.planCode === "free"
                              ? alpha("#6B9CD8", 0.3)
                              : alpha("#22c55e", 0.3)
                          }`,
                        }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      {org.subscriptionStatus ? (
                        <Chip
                          label={org.subscriptionStatus}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: "0.7rem",
                            backgroundColor:
                              org.subscriptionStatus === "active"
                                ? alpha("#22c55e", 0.1)
                                : org.subscriptionStatus === "canceled"
                                  ? alpha("#ef4444", 0.1)
                                  : alpha("#f59e0b", 0.1),
                            color:
                              org.subscriptionStatus === "active"
                                ? "#22c55e"
                                : org.subscriptionStatus === "canceled"
                                  ? "#ef4444"
                                  : "#f59e0b",
                            border: `1px solid ${
                              org.subscriptionStatus === "active"
                                ? alpha("#22c55e", 0.3)
                                : org.subscriptionStatus === "canceled"
                                  ? alpha("#ef4444", 0.3)
                                  : alpha("#f59e0b", 0.3)
                            }`,
                          }}
                        />
                      ) : (
                        <Chip
                          label="N/A"
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: "0.7rem",
                            backgroundColor: alpha("#6B9CD8", 0.1),
                            color: "#6B9CD8",
                            border: `1px solid ${alpha("#6B9CD8", 0.3)}`,
                          }}
                        />
                      )}
                    </TableCell>
                    <TableCell align="center">
                      {(org.apps ?? []).length === 0 ? (
                        <Typography
                          variant="caption"
                          sx={{ fontSize: "0.7rem", color: "text.secondary", fontStyle: "italic" }}
                        >
                          none
                        </Typography>
                      ) : (
                        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", justifyContent: "center" }}>
                          {(org.apps ?? []).map((appKey) => {
                            const meta = KLORAD_APPS.find((a) => a.key === appKey);
                            return (
                              <Chip
                                key={appKey}
                                label={meta?.label ?? appKey}
                                size="small"
                                sx={{
                                  height: 20,
                                  fontSize: "0.7rem",
                                  backgroundColor: alpha("#6B9CD8", 0.1),
                                  color: "#6B9CD8",
                                  border: `1px solid ${alpha("#6B9CD8", 0.3)}`,
                                }}
                              />
                            );
                          })}
                        </Box>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        sx={{
                          fontSize: "0.75rem",
                          color: "text.primary",
                        }}
                      >
                        {org.memberCount}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        sx={{
                          fontSize: "0.75rem",
                          color: "text.primary",
                        }}
                      >
                        {org.projectCount}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        sx={{
                          fontSize: "0.75rem",
                          color: "text.primary",
                        }}
                      >
                        {org.assetCount}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          fontSize: "0.75rem",
                          color: "text.secondary",
                        }}
                      >
                        {new Date(org.createdAt).toLocaleDateString()}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Box
                        sx={{
                          display: "flex",
                          gap: 1,
                          justifyContent: "flex-end",
                          flexWrap: "wrap",
                        }}
                      >
                        {org.isPersonal && (
                          <Button
                            variant="contained"
                            size="small"
                            onClick={() =>
                              onUpgradeClick({ id: org.id, name: org.name })
                            }
                            sx={(theme) => ({
                              textTransform: "none",
                              fontSize: "0.75rem",
                              fontWeight: 500,
                              backgroundColor:
                                theme.palette.mode === "dark"
                                  ? "#161B20"
                                  : theme.palette.background.paper,
                              color: theme.palette.primary.main,
                              border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                              padding: "6px 16px",
                              boxShadow: "none",
                              "&:hover": {
                                backgroundColor:
                                  theme.palette.mode === "dark"
                                    ? "#1a1f26"
                                    : alpha(theme.palette.primary.main, 0.05),
                                borderColor: alpha(
                                  theme.palette.primary.main,
                                  0.5
                                ),
                              },
                            })}
                          >
                            Upgrade to Organization
                          </Button>
                        )}
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<PeopleIcon />}
                          onClick={() =>
                            onMembersClick({
                              id: org.id,
                              name: org.name,
                              isPersonal: org.isPersonal,
                            })
                          }
                          disabled={org.isPersonal}
                          sx={(theme) => ({
                            textTransform: "none",
                            fontSize: "0.75rem",
                            fontWeight: 500,
                            borderColor: alpha(
                              theme.palette.primary.main,
                              0.3
                            ),
                            color: theme.palette.primary.main,
                            "&:hover": {
                              borderColor: alpha(
                                theme.palette.primary.main,
                                0.5
                              ),
                              backgroundColor: alpha(
                                theme.palette.primary.main,
                                0.05
                              ),
                            },
                            "&.Mui-disabled": {
                              borderColor: alpha(
                                theme.palette.primary.main,
                                0.1
                              ),
                              color: alpha(theme.palette.primary.main, 0.3),
                            },
                          })}
                          title={
                            org.isPersonal
                              ? "Personal organizations cannot have multiple members"
                              : "Manage members"
                          }
                        >
                          Members
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => onLicenseClick(org)}
                          sx={(theme) => ({
                            textTransform: "none",
                            fontSize: "0.75rem",
                            fontWeight: 500,
                            minWidth: 100,
                            borderColor: alpha(
                              theme.palette.primary.main,
                              0.3
                            ),
                            color: theme.palette.primary.main,
                            "&:hover": {
                              borderColor: alpha(
                                theme.palette.primary.main,
                                0.5
                              ),
                              backgroundColor: alpha(
                                theme.palette.primary.main,
                                0.05
                              ),
                            },
                          })}
                        >
                          License
                        </Button>
                        <IconButton
                          size="small"
                          onClick={(e) =>
                            setMenuAnchor({
                              element: e.currentTarget,
                              orgId: org.id,
                              orgName: org.name,
                              orgApps: org.apps ?? [],
                            })
                          }
                          sx={(theme) => ({
                            color: theme.palette.text.secondary,
                            padding: "4px",
                            "&:hover": {
                              backgroundColor: "rgba(255, 255, 255, 0.08)",
                              color: theme.palette.text.primary,
                            },
                          })}
                        >
                          <MoreVert fontSize="small" />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </PageCard>
      </Box>

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor?.element || null}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        sx={{
          "& .MuiPaper-root": {
            backgroundColor: "#14171A",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            boxShadow: "none",
            borderRadius: "4px",
            minWidth: "120px",
          },
        }}
      >
        <MenuItem
          onClick={() => {
            if (menuAnchor) {
              onAppsClick({
                id: menuAnchor.orgId,
                name: menuAnchor.orgName,
                apps: menuAnchor.orgApps,
              });
              setMenuAnchor(null);
            }
          }}
          sx={{
            fontSize: "0.75rem",
            padding: "8px 16px",
          }}
        >
          Edit apps
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuAnchor) {
              onDeleteClick({
                id: menuAnchor.orgId,
                name: menuAnchor.orgName,
              });
              setMenuAnchor(null);
            }
          }}
          sx={{
            fontSize: "0.75rem",
            color: "error.main",
            padding: "8px 16px",
            "&:hover": {
              backgroundColor: alpha("#ef4444", 0.1),
            },
          }}
        >
          Delete
        </MenuItem>
      </Menu>
    </>
  );
}

