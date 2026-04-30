"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Typography,
} from "@mui/material";
import {
  Page,
  PageCard,
  PageContent,
  PageSection,
  TextField,
  showToast,
} from "@klorad/ui";
import { useOrganization } from "@/app/hooks/useOrganizations";

export default function SettingsGeneralPage() {
  const params = useParams<{ orgId: string }>();
  const orgId = params?.orgId ?? "";
  const { organization, loadingOrganization, error: orgError, mutate } =
    useOrganization(orgId);

  const [formData, setFormData] = useState({ name: "", slug: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (organization) {
      setFormData({
        name: organization.name || "",
        slug: organization.slug || "",
      });
    }
  }, [organization]);

  const loading = loadingOrganization;
  const error = orgError ? "Failed to load organization data" : null;

  const handleChange =
    (field: "name" | "slug") =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const handleSave = async () => {
    if (!organization || !orgId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/organizations/${orgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          ...(organization.isPersonal ? {} : { slug: formData.slug }),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update organization");
      }
      await mutate();
      showToast("Organization updated successfully", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to update", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Page>
        <PageContent sx={{ mt: 0 }}>
          <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
            <CircularProgress />
          </Box>
        </PageContent>
      </Page>
    );
  }

  if (!organization) {
    return (
      <Page>
        <PageContent sx={{ mt: 0 }}>
          <Alert severity="error">Organization not found</Alert>
        </PageContent>
      </Page>
    );
  }

  const hasChanges =
    formData.name !== organization.name || formData.slug !== (organization.slug ?? "");
  const canEdit =
    organization.userRole === "owner" || organization.userRole === "admin";
  const scopeLabel = organization.isPersonal ? "Workspace" : "Organization";

  return (
    <Page>
      <PageContent sx={{ mt: 0 }} maxWidth="5xl">
        <Box
          sx={(theme) => ({
            display: "flex",
            gap: 2,
            mb: 3,
            pb: 3,
            alignItems: "center",
            justifyContent: "flex-end",
            borderBottom: `1px solid ${theme.palette.divider}`,
          })}
        >
          {hasChanges && (
            <Button
              variant="outlined"
              onClick={() =>
                setFormData({
                  name: organization.name,
                  slug: organization.slug ?? "",
                })
              }
              disabled={saving}
              size="small"
              sx={{ textTransform: "none", fontSize: "0.75rem", fontWeight: 500 }}
            >
              Cancel
            </Button>
          )}
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!canEdit || !hasChanges || saving}
            size="small"
            sx={{
              textTransform: "none",
              fontSize: "0.75rem",
              fontWeight: 500,
              minWidth: 120,
              "&:disabled": { opacity: 0.5 },
            }}
          >
            {saving ? <CircularProgress size={16} /> : "Save"}
          </Button>
        </Box>

        <PageCard>
          <Typography variant="h6" sx={{ mb: 3, fontWeight: 600, fontSize: "1rem" }}>
            {scopeLabel} Settings
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {!canEdit && (
            <Alert severity="info" sx={{ mb: 2 }}>
              You need admin or owner role to edit {scopeLabel.toLowerCase()} settings.
            </Alert>
          )}

          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <Box>
              <Typography
                sx={{ fontSize: "0.75rem", fontWeight: 600, mb: 0.5 }}
              >
                {scopeLabel} Name *
              </Typography>
              <TextField
                value={formData.name}
                onChange={handleChange("name")}
                fullWidth
                size="small"
                disabled={!canEdit || saving}
                placeholder={`Enter ${scopeLabel.toLowerCase()} name`}
              />
            </Box>

            <Box>
              <Typography
                sx={{ fontSize: "0.75rem", fontWeight: 600, mb: 0.5 }}
              >
                Slug *
              </Typography>
              <TextField
                value={formData.slug}
                onChange={handleChange("slug")}
                fullWidth
                size="small"
                disabled={!canEdit || saving || organization.isPersonal}
                placeholder={`Enter ${scopeLabel.toLowerCase()} slug`}
              />
              <Typography
                sx={(theme) => ({
                  fontSize: "0.75rem",
                  color: theme.palette.text.secondary,
                  mt: 0.5,
                })}
              >
                {organization.isPersonal
                  ? "Personal organization slug cannot be changed"
                  : "URL-friendly identifier (lowercase letters, numbers, hyphens, underscores)"}
              </Typography>
            </Box>

            <PageSection title={`${scopeLabel} Information`} spacing="tight">
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {scopeLabel} ID: {organization.id}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Type: {organization.isPersonal ? "Personal" : "Team"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Your Role: {organization.userRole || "Member"}
              </Typography>
            </PageSection>
          </Box>
        </PageCard>
      </PageContent>
    </Page>
  );
}
