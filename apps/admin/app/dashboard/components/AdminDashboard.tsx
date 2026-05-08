"use client";

import React, { useState, useCallback } from "react";
import {
  Box,
  Dialog,
  TextField,
  Select,
  MenuItem,
  FormControl,
  IconButton,
  Divider,
  Button,
  Typography,
  alpha,
  CircularProgress,
} from "@mui/material";
import { PageContainer } from "../../components/PageContainer";
import {
  PageHeader,
  PageDescription,
  PageContent,
  textFieldStyles,
  SettingContainer,
  SettingLabel,
  CloseIcon,
} from "@klorad/ui";
import MembersDialog from "./MembersDialog";
import AppsDialog from "./AppsDialog";
import { KLORAD_APPS, type KloradApp } from "./appsConfig";
import { showToast } from "@klorad/ui";
import { Checkbox, FormControlLabel } from "@mui/material";
import useSWR from "swr";
import { AdminHeader } from "../../components/AdminHeader";
import { DashboardTabs } from "./tabs/DashboardTabs";
import { OverviewTab } from "./tabs/OverviewTab";
import { OrganizationsTab } from "./tabs/OrganizationsTab";
import { UsersTab } from "./tabs/UsersTab";
import { ShowcaseTab } from "./tabs/ShowcaseTab";

interface Plan {
  code: string;
  name: string;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(error.error || `Failed to fetch: ${res.statusText}`);
  }
  return res.json();
};

export default function AdminDashboard() {
  const [currentTab, setCurrentTab] = useState("overview");
  const { data: plansData } = useSWR<{ plans: Plan[] }>("/api/plans", fetcher);

  const [loading, setLoading] = useState(false);
  const [createOrgOpen, setCreateOrgOpen] = useState(false);
  const [deleteOrgOpen, setDeleteOrgOpen] = useState(false);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [licenseDialogOpen, setLicenseDialogOpen] = useState(false);
  const [orgToDelete, setOrgToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [orgToUpgrade, setOrgToUpgrade] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [orgToUpdate, setOrgToUpdate] = useState<{
    id: string;
    name: string;
    planCode: string;
    subscriptionStatus: string | null;
  } | null>(null);
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<{
    id: string;
    name: string;
    isPersonal: boolean;
  } | null>(null);

  // Create organization form state
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [orgApps, setOrgApps] = useState<Set<KloradApp>>(new Set());
  const [saving, setSaving] = useState(false);

  const [appsDialogOpen, setAppsDialogOpen] = useState(false);
  const [orgForApps, setOrgForApps] = useState<{
    id: string;
    name: string;
    apps: string[];
  } | null>(null);

  // License update form state
  const [selectedPlanCode, setSelectedPlanCode] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");

  const plans = plansData?.plans || [];

  const handleCreateOrganization = useCallback(async () => {
    if (!orgName.trim() || !orgSlug.trim()) return;

    setSaving(true);
    try {
      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: orgName.trim(),
          slug: orgSlug.trim(),
          apps: Array.from(orgApps),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create organization");
      }

      showToast("Organization created successfully!", "success");
      // Trigger revalidation for organizations tab by mutating the key
      // SWR will handle re-fetching next time the key is used or if it's currently mounted
      // mutate("/api/stats?section=organizations");
      setCreateOrgOpen(false);
      setOrgName("");
      setOrgSlug("");
      setOrgApps(new Set());
    } catch (error) {
      console.error("Error creating organization:", error);
      showToast(
        error instanceof Error
          ? error.message
          : "Failed to create organization",
        "error"
      );
    } finally {
      setSaving(false);
    }
  }, [orgName, orgSlug, orgApps]);

  const handleDeleteOrganization = useCallback(async () => {
    if (!orgToDelete) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/organizations/${orgToDelete.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete organization");
      }

      showToast("Organization deleted successfully!", "success");
      setDeleteOrgOpen(false);
      setOrgToDelete(null);
    } catch (error) {
      console.error("Error deleting organization:", error);
      showToast(
        error instanceof Error
          ? error.message
          : "Failed to delete organization",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }, [orgToDelete]);

  const handleOpenDeleteDialog = useCallback(
    (org: { id: string; name: string }) => {
      setOrgToDelete(org);
      setDeleteOrgOpen(true);
    },
    []
  );

  const handleUpgradeWorkspace = useCallback(async () => {
    if (!orgToUpgrade) return;

    setLoading(true);
    try {
      const response = await fetch(
        `/api/organizations/${orgToUpgrade.id}/upgrade`,
        {
          method: "PATCH",
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to upgrade workspace");
      }

      showToast(
        "Personal workspace upgraded to organization successfully!",
        "success"
      );
      setUpgradeDialogOpen(false);
      setOrgToUpgrade(null);
    } catch (error) {
      console.error("Error upgrading workspace:", error);
      showToast(
        error instanceof Error ? error.message : "Failed to upgrade workspace",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }, [orgToUpgrade]);

  const handleOpenUpgradeDialog = useCallback(
    (org: { id: string; name: string }) => {
      setOrgToUpgrade(org);
      setUpgradeDialogOpen(true);
    },
    []
  );

  const handleUpdateLicense = useCallback(async () => {
    if (!orgToUpdate) return;

    setLoading(true);
    try {
      const response = await fetch(
        `/api/organizations/${orgToUpdate.id}/license`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planCode: selectedPlanCode || undefined,
            subscriptionStatus: selectedStatus || null,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update license");
      }

      showToast("License updated successfully!", "success");
      setLicenseDialogOpen(false);
      setOrgToUpdate(null);
      setSelectedPlanCode("");
      setSelectedStatus("");
    } catch (error) {
      console.error("Error updating license:", error);
      showToast(
        error instanceof Error ? error.message : "Failed to update license",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }, [orgToUpdate, selectedPlanCode, selectedStatus]);

  const openLicenseDialog = useCallback(
    (org: {
      id: string;
      name: string;
      planCode: string;
      subscriptionStatus: string | null;
    }) => {
      setOrgToUpdate(org);
      setSelectedPlanCode(org.planCode);
      setSelectedStatus(org.subscriptionStatus || "");
      setLicenseDialogOpen(true);
    },
    []
  );

  if (!plansData) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <AdminHeader />
      <PageContainer>
        <PageHeader title="Admin Dashboard" />
        <PageDescription>
          Manage organizations, licenses, and view platform analytics
        </PageDescription>

        <PageContent maxWidth="full">
          <DashboardTabs
            currentTab={currentTab}
            onTabChange={setCurrentTab}
          />

          {currentTab === "overview" && <OverviewTab />}

          {currentTab === "organizations" && (
            <OrganizationsTab
              onCreateClick={() => setCreateOrgOpen(true)}
              onUpgradeClick={handleOpenUpgradeDialog}
              onMembersClick={(org) => {
                setSelectedOrg(org);
                setMembersDialogOpen(true);
              }}
              onLicenseClick={openLicenseDialog}
              onAppsClick={(org) => {
                setOrgForApps(org);
                setAppsDialogOpen(true);
              }}
              onDeleteClick={handleOpenDeleteDialog}
            />
          )}

          {currentTab === "users" && <UsersTab />}
          {currentTab === "showcase" && <ShowcaseTab />}
        </PageContent>
      </PageContainer>

      {/* Create Organization Dialog */}
      <Dialog
        open={createOrgOpen}
        onClose={() => setCreateOrgOpen(false)}
        maxWidth="sm"
        fullWidth
        sx={(theme) => ({
          "& .MuiDialog-paper": {
            backgroundColor:
              theme.palette.mode === "dark"
                ? "#14171A !important"
                : theme.palette.background.paper,
          },
        })}
        PaperProps={{
          sx: (theme) => ({
            backgroundColor:
              theme.palette.mode === "dark"
                ? "#14171A !important"
                : theme.palette.background.paper,
            boxShadow: "none",
            backgroundImage: "none",
            "&.MuiPaper-root": {
              backgroundColor:
                theme.palette.mode === "dark"
                  ? "#14171A !important"
                  : theme.palette.background.paper,
              boxShadow: "none",
            },
          }),
        }}
        BackdropProps={{
          sx: {
            backgroundColor: "rgba(0, 0, 0, 0.5)",
          },
        }}
      >
        <Box
          sx={(theme) => ({
            backgroundColor:
              theme.palette.mode === "dark"
                ? "#14171A"
                : theme.palette.background.paper,
          })}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              p: 2,
              pb: 1,
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: "1rem" }}>
              Create Organization
            </Typography>
            <IconButton
              onClick={() => setCreateOrgOpen(false)}
              size="small"
              sx={{ color: "text.secondary" }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
          <Divider />
          <Box sx={{ p: 2 }}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <SettingContainer>
                <SettingLabel>Organization Name</SettingLabel>
                <TextField
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  fullWidth
                  required
                  sx={textFieldStyles}
                />
              </SettingContainer>
              <SettingContainer>
                <SettingLabel>Slug</SettingLabel>
                <TextField
                  value={orgSlug}
                  onChange={(e) => setOrgSlug(e.target.value)}
                  fullWidth
                  required
                  helperText="Lowercase letters, numbers, hyphens, and underscores only"
                  sx={textFieldStyles}
                />
              </SettingContainer>
              <SettingContainer>
                <SettingLabel>Enabled apps</SettingLabel>
                <Box sx={{ display: "flex", flexDirection: "column" }}>
                  {KLORAD_APPS.map((app) => (
                    <FormControlLabel
                      key={app.key}
                      control={
                        <Checkbox
                          size="small"
                          checked={orgApps.has(app.key)}
                          onChange={() =>
                            setOrgApps((prev) => {
                              const next = new Set(prev);
                              if (next.has(app.key)) next.delete(app.key);
                              else next.add(app.key);
                              return next;
                            })
                          }
                        />
                      }
                      label={
                        <Typography
                          variant="body2"
                          sx={{ fontSize: "0.8125rem" }}
                        >
                          {app.label}{" "}
                          <Typography
                            component="span"
                            variant="caption"
                            sx={{ fontSize: "0.7rem", color: "text.secondary" }}
                          >
                            — {app.description}
                          </Typography>
                        </Typography>
                      }
                      sx={{ m: 0, py: 0.25 }}
                    />
                  ))}
                </Box>
              </SettingContainer>
            </Box>
          </Box>
          <Divider />
          <Box
            sx={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 1,
              p: 2,
            }}
          >
            <Button
              onClick={() => setCreateOrgOpen(false)}
              disabled={saving}
              variant="outlined"
              sx={(theme) => ({
                textTransform: "none",
                fontSize: "0.75rem",
                fontWeight: 500,
                borderColor: alpha(theme.palette.primary.main, 0.3),
                color: theme.palette.primary.main,
                "&:hover": {
                  borderColor: alpha(theme.palette.primary.main, 0.5),
                  backgroundColor: alpha(theme.palette.primary.main, 0.05),
                },
              })}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateOrganization}
              variant="contained"
              disabled={saving || !orgName.trim() || !orgSlug.trim()}
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
                boxShadow: "none",
                "&:hover": {
                  backgroundColor:
                    theme.palette.mode === "dark"
                      ? "#1a1f26"
                      : alpha(theme.palette.primary.main, 0.05),
                  borderColor: alpha(theme.palette.primary.main, 0.5),
                },
                "&.Mui-disabled": {
                  backgroundColor: alpha(theme.palette.primary.main, 0.05),
                  color: alpha(theme.palette.primary.main, 0.3),
                  borderColor: alpha(theme.palette.primary.main, 0.1),
                },
              })}
            >
              {saving ? "Creating..." : "Create"}
            </Button>
          </Box>
        </Box>
      </Dialog>

      {/* Delete Organization Dialog */}
      <Dialog
        open={deleteOrgOpen}
        onClose={() => setDeleteOrgOpen(false)}
        maxWidth="sm"
        fullWidth
        sx={(theme) => ({
          "& .MuiDialog-paper": {
            backgroundColor:
              theme.palette.mode === "dark"
                ? "#14171A !important"
                : theme.palette.background.paper,
          },
        })}
        PaperProps={{
          sx: (theme) => ({
            backgroundColor:
              theme.palette.mode === "dark"
                ? "#14171A !important"
                : theme.palette.background.paper,
            boxShadow: "none",
            backgroundImage: "none",
            "&.MuiPaper-root": {
              backgroundColor:
                theme.palette.mode === "dark"
                  ? "#14171A !important"
                  : theme.palette.background.paper,
              boxShadow: "none",
            },
          }),
        }}
        BackdropProps={{
          sx: {
            backgroundColor: "rgba(0, 0, 0, 0.5)",
          },
        }}
      >
        <Box
          sx={(theme) => ({
            backgroundColor:
              theme.palette.mode === "dark"
                ? "#14171A"
                : theme.palette.background.paper,
          })}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              p: 2,
              pb: 1,
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: "1rem" }}>
              Delete Organization
            </Typography>
            <IconButton
              onClick={() => setDeleteOrgOpen(false)}
              size="small"
              sx={{ color: "text.secondary" }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
          <Divider />
          <Box sx={{ p: 2 }}>
            <Typography
              variant="body2"
              sx={{ fontSize: "0.75rem", color: "text.secondary" }}
            >
              Are you sure you want to delete &quot;{orgToDelete?.name}&quot;?
              This action cannot be undone and will permanently delete all
              associated data, including projects, assets, members, and
              integrations.
            </Typography>
          </Box>
          <Divider />
          <Box
            sx={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 1,
              p: 2,
            }}
          >
            <Button
              onClick={() => setDeleteOrgOpen(false)}
              disabled={loading}
              variant="outlined"
              sx={(theme) => ({
                textTransform: "none",
                fontSize: "0.75rem",
                fontWeight: 500,
                borderColor: alpha(theme.palette.primary.main, 0.3),
                color: theme.palette.primary.main,
                "&:hover": {
                  borderColor: alpha(theme.palette.primary.main, 0.5),
                  backgroundColor: alpha(theme.palette.primary.main, 0.05),
                },
              })}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteOrganization}
              variant="contained"
              disabled={loading}
              sx={(theme) => ({
                textTransform: "none",
                fontSize: "0.75rem",
                fontWeight: 500,
                backgroundColor: alpha(theme.palette.error.main, 0.1),
                color: theme.palette.error.main,
                border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
                boxShadow: "none",
                "&:hover": {
                  backgroundColor: alpha(theme.palette.error.main, 0.15),
                  borderColor: alpha(theme.palette.error.main, 0.5),
                },
                "&.Mui-disabled": {
                  backgroundColor: alpha(theme.palette.error.main, 0.05),
                  color: alpha(theme.palette.error.main, 0.3),
                  borderColor: alpha(theme.palette.error.main, 0.1),
                },
              })}
            >
              {loading ? "Deleting..." : "Delete"}
            </Button>
          </Box>
        </Box>
      </Dialog>

      {/* Upgrade Workspace Dialog */}
      <Dialog
        open={upgradeDialogOpen}
        onClose={() => setUpgradeDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        sx={(theme) => ({
          "& .MuiDialog-paper": {
            backgroundColor:
              theme.palette.mode === "dark"
                ? "#14171A !important"
                : theme.palette.background.paper,
          },
        })}
        PaperProps={{
          sx: (theme) => ({
            backgroundColor:
              theme.palette.mode === "dark"
                ? "#14171A !important"
                : theme.palette.background.paper,
            boxShadow: "none",
            backgroundImage: "none",
            "&.MuiPaper-root": {
              backgroundColor:
                theme.palette.mode === "dark"
                  ? "#14171A !important"
                  : theme.palette.background.paper,
              boxShadow: "none",
            },
          }),
        }}
        BackdropProps={{
          sx: {
            backgroundColor: "rgba(0, 0, 0, 0.5)",
          },
        }}
      >
        <Box
          sx={(theme) => ({
            backgroundColor:
              theme.palette.mode === "dark"
                ? "#14171A"
                : theme.palette.background.paper,
          })}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              p: 2,
              pb: 1,
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: "1rem" }}>
              Upgrade Personal Workspace to Organization
            </Typography>
            <IconButton
              onClick={() => setUpgradeDialogOpen(false)}
              size="small"
              sx={{ color: "text.secondary" }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
          <Divider />
          <Box sx={{ p: 2 }}>
            <Typography
              variant="body2"
              sx={{ fontSize: "0.75rem", color: "text.secondary", mb: 2 }}
            >
              Are you sure you want to upgrade &quot;{orgToUpgrade?.name}&quot;
              from a personal workspace to a full organization?
            </Typography>
            <Typography
              variant="body2"
              sx={{ fontSize: "0.75rem", color: "text.secondary", mb: 1 }}
            >
              This will:
            </Typography>
            <Box component="ul" sx={{ pl: 3, mb: 2 }}>
              <Typography
                component="li"
                variant="body2"
                sx={{ fontSize: "0.75rem", color: "text.secondary", mb: 0.5 }}
              >
                Enable multiple members to join the organization
              </Typography>
              <Typography
                component="li"
                variant="body2"
                sx={{ fontSize: "0.75rem", color: "text.secondary", mb: 0.5 }}
              >
                Allow organization invitations
              </Typography>
              <Typography
                component="li"
                variant="body2"
                sx={{ fontSize: "0.75rem", color: "text.secondary" }}
              >
                Preserve all existing projects, assets, and data
              </Typography>
            </Box>
            <Typography
              variant="body2"
              sx={{ fontSize: "0.75rem", color: "text.secondary" }}
            >
              This action cannot be undone.
            </Typography>
          </Box>
          <Divider />
          <Box
            sx={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 1,
              p: 2,
            }}
          >
            <Button
              onClick={() => setUpgradeDialogOpen(false)}
              disabled={loading}
              variant="outlined"
              sx={(theme) => ({
                textTransform: "none",
                fontSize: "0.75rem",
                fontWeight: 500,
                borderColor: alpha(theme.palette.primary.main, 0.3),
                color: theme.palette.primary.main,
                "&:hover": {
                  borderColor: alpha(theme.palette.primary.main, 0.5),
                  backgroundColor: alpha(theme.palette.primary.main, 0.05),
                },
              })}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpgradeWorkspace}
              variant="contained"
              disabled={loading}
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
                boxShadow: "none",
                "&:hover": {
                  backgroundColor:
                    theme.palette.mode === "dark"
                      ? "#1a1f26"
                      : alpha(theme.palette.primary.main, 0.05),
                  borderColor: alpha(theme.palette.primary.main, 0.5),
                },
                "&.Mui-disabled": {
                  backgroundColor: alpha(theme.palette.primary.main, 0.05),
                  color: alpha(theme.palette.primary.main, 0.3),
                  borderColor: alpha(theme.palette.primary.main, 0.1),
                },
              })}
            >
              {loading ? "Upgrading..." : "Upgrade to Organization"}
            </Button>
          </Box>
        </Box>
      </Dialog>

      {/* License Management Dialog */}
      <Dialog
        open={licenseDialogOpen}
        onClose={() => setLicenseDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        sx={(theme) => ({
          "& .MuiDialog-paper": {
            backgroundColor:
              theme.palette.mode === "dark"
                ? "#14171A !important"
                : theme.palette.background.paper,
          },
        })}
        PaperProps={{
          sx: (theme) => ({
            backgroundColor:
              theme.palette.mode === "dark"
                ? "#14171A !important"
                : theme.palette.background.paper,
            boxShadow: "none",
            backgroundImage: "none",
            "&.MuiPaper-root": {
              backgroundColor:
                theme.palette.mode === "dark"
                  ? "#14171A !important"
                  : theme.palette.background.paper,
              boxShadow: "none",
            },
          }),
        }}
        BackdropProps={{
          sx: {
            backgroundColor: "rgba(0, 0, 0, 0.5)",
          },
        }}
      >
        <Box
          sx={(theme) => ({
            backgroundColor:
              theme.palette.mode === "dark"
                ? "#14171A"
                : theme.palette.background.paper,
          })}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              p: 2,
              pb: 1,
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: "1rem" }}>
              Manage License - {orgToUpdate?.name}
            </Typography>
            <IconButton
              onClick={() => setLicenseDialogOpen(false)}
              size="small"
              sx={{ color: "text.secondary" }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
          <Divider />
          <Box sx={{ p: 2 }}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <SettingContainer>
                <SettingLabel>Plan</SettingLabel>
                <FormControl fullWidth>
                  <Select
                    value={selectedPlanCode}
                    onChange={(e) => setSelectedPlanCode(e.target.value)}
                    sx={textFieldStyles}
                  >
                    {plans.map((plan) => (
                      <MenuItem key={plan.code} value={plan.code}>
                        {plan.name} ({plan.code})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </SettingContainer>
              <SettingContainer>
                <SettingLabel>Subscription Status</SettingLabel>
                <FormControl fullWidth>
                  <Select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    sx={textFieldStyles}
                  >
                    <MenuItem value="">None</MenuItem>
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="canceled">Canceled</MenuItem>
                    <MenuItem value="past_due">Past Due</MenuItem>
                    <MenuItem value="trialing">Trialing</MenuItem>
                    <MenuItem value="incomplete">Incomplete</MenuItem>
                    <MenuItem value="incomplete_expired">
                      Incomplete Expired
                    </MenuItem>
                    <MenuItem value="unpaid">Unpaid</MenuItem>
                  </Select>
                </FormControl>
              </SettingContainer>
            </Box>
          </Box>
          <Divider />
          <Box
            sx={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 1,
              p: 2,
            }}
          >
            <Button
              onClick={() => setLicenseDialogOpen(false)}
              disabled={loading}
              variant="outlined"
              sx={(theme) => ({
                textTransform: "none",
                fontSize: "0.75rem",
                fontWeight: 500,
                borderColor: alpha(theme.palette.primary.main, 0.3),
                color: theme.palette.primary.main,
                "&:hover": {
                  borderColor: alpha(theme.palette.primary.main, 0.5),
                  backgroundColor: alpha(theme.palette.primary.main, 0.05),
                },
              })}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateLicense}
              variant="contained"
              disabled={loading}
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
                boxShadow: "none",
                "&:hover": {
                  backgroundColor:
                    theme.palette.mode === "dark"
                      ? "#1a1f26"
                      : alpha(theme.palette.primary.main, 0.05),
                  borderColor: alpha(theme.palette.primary.main, 0.5),
                },
                "&.Mui-disabled": {
                  backgroundColor: alpha(theme.palette.primary.main, 0.05),
                  color: alpha(theme.palette.primary.main, 0.3),
                  borderColor: alpha(theme.palette.primary.main, 0.1),
                },
              })}
            >
              {loading ? "Updating..." : "Update License"}
            </Button>
          </Box>
        </Box>
      </Dialog>

      {/* Apps Management Dialog */}
      {orgForApps && (
        <AppsDialog
          open={appsDialogOpen}
          orgId={orgForApps.id}
          orgName={orgForApps.name}
          initialApps={orgForApps.apps}
          onClose={() => {
            setAppsDialogOpen(false);
            setOrgForApps(null);
          }}
        />
      )}

      {/* Members Management Dialog */}
      {selectedOrg && (
        <MembersDialog
          open={membersDialogOpen}
          orgId={selectedOrg.id}
          orgName={selectedOrg.name}
          isPersonal={selectedOrg.isPersonal}
          onClose={() => {
            setMembersDialogOpen(false);
            setSelectedOrg(null);
          }}
          // We don't need explicit onUpdate as swr handles revalidation via mutation if needed
          // but if MembersDialog calls it, we can pass a no-op or specific revalidator
          onUpdate={() => {}}
        />
      )}
    </>
  );
}
