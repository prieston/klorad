"use client";

import React, { useEffect, useState } from "react";
import {
  Dialog,
  Box,
  Typography,
  IconButton,
  Divider,
  Checkbox,
  FormControlLabel,
  Button,
  alpha,
} from "@mui/material";
import { CloseIcon, showToast } from "@klorad/ui";
import { KLORAD_APPS, type KloradApp } from "./appsConfig";

interface Props {
  open: boolean;
  orgId: string;
  orgName: string;
  initialApps: string[];
  onClose: () => void;
  onSaved?: (apps: KloradApp[]) => void;
}

export default function AppsDialog({
  open,
  orgId,
  orgName,
  initialApps,
  onClose,
  onSaved,
}: Props) {
  const [selected, setSelected] = useState<Set<KloradApp>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setSelected(new Set(initialApps.filter((a): a is KloradApp =>
        KLORAD_APPS.some((app) => app.key === a)
      )));
    }
  }, [open, initialApps]);

  const toggle = (key: KloradApp) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const apps = Array.from(selected);
      const res = await fetch(`/api/organizations/${orgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apps }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || "Failed to update apps");
      }
      showToast("Apps updated", "success");
      onSaved?.(apps);
      onClose();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to update apps", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: (theme) => ({
          backgroundColor:
            theme.palette.mode === "dark"
              ? "#14171A !important"
              : theme.palette.background.paper,
          boxShadow: "none",
          backgroundImage: "none",
        }),
      }}
      BackdropProps={{ sx: { backgroundColor: "rgba(0, 0, 0, 0.5)" } }}
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
          Enabled apps — {orgName}
        </Typography>
        <IconButton onClick={onClose} size="small" sx={{ color: "text.secondary" }}>
          <CloseIcon />
        </IconButton>
      </Box>
      <Divider />
      <Box sx={{ p: 2 }}>
        <Typography
          variant="body2"
          sx={{ fontSize: "0.75rem", color: "text.secondary", mb: 2 }}
        >
          Pick which Klorad apps this organization can log into. Each consumer
          app filters its workspace list to orgs tagged with its key.
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {KLORAD_APPS.map((app) => (
            <FormControlLabel
              key={app.key}
              control={
                <Checkbox
                  checked={selected.has(app.key)}
                  onChange={() => toggle(app.key)}
                  size="small"
                />
              }
              label={
                <Box>
                  <Typography variant="body2" sx={{ fontSize: "0.8125rem", fontWeight: 600 }}>
                    {app.label}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ fontSize: "0.7rem", color: "text.secondary" }}
                  >
                    {app.description}
                  </Typography>
                </Box>
              }
              sx={{
                alignItems: "flex-start",
                m: 0,
                py: 0.75,
                px: 1,
                borderRadius: 1,
                "&:hover": { backgroundColor: (t) => alpha(t.palette.primary.main, 0.04) },
              }}
            />
          ))}
        </Box>
      </Box>
      <Divider />
      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, p: 2 }}>
        <Button
          onClick={onClose}
          disabled={saving}
          variant="outlined"
          sx={(t) => ({
            textTransform: "none",
            fontSize: "0.75rem",
            fontWeight: 500,
            borderColor: alpha(t.palette.primary.main, 0.3),
            color: t.palette.primary.main,
            "&:hover": {
              borderColor: alpha(t.palette.primary.main, 0.5),
              backgroundColor: alpha(t.palette.primary.main, 0.05),
            },
          })}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving}
          variant="contained"
          sx={(t) => ({
            textTransform: "none",
            fontSize: "0.75rem",
            fontWeight: 500,
            backgroundColor:
              t.palette.mode === "dark" ? "#161B20" : t.palette.background.paper,
            color: t.palette.primary.main,
            border: `1px solid ${alpha(t.palette.primary.main, 0.3)}`,
            boxShadow: "none",
            "&:hover": {
              backgroundColor:
                t.palette.mode === "dark"
                  ? "#1a1f26"
                  : alpha(t.palette.primary.main, 0.05),
              borderColor: alpha(t.palette.primary.main, 0.5),
            },
          })}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </Box>
    </Dialog>
  );
}
