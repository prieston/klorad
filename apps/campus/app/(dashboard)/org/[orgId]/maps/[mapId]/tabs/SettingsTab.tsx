"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Button,
  IconButton,
  InputAdornment,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { toast } from "react-toastify";
import { PageCard, PageSection, TextField, FormField } from "@klorad/ui";

interface Props {
  orgId: string;
  mapId: string;
  map: {
    id: string;
    name: string;
  };
}

export default function SettingsTab({ orgId: _orgId, mapId, map }: Props) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const publicUrl = `${origin}/campus/${mapId}`;
  const embedCode = `<iframe src="${publicUrl}" width="100%" height="600" frameborder="0" allowfullscreen></iframe>`;

  const [copied, setCopied] = useState<"url" | "embed" | null>(null);
  const copy = (text: string, kind: "url" | "embed") => {
    navigator.clipboard.writeText(text);
    setCopied(kind);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Stack spacing={4} sx={{ mt: 3 }}>
      <PageSection title="General" spacing="tight">
        <PageCard>
          <Stack spacing={2}>
            <FormField label="Campus name">
              <TextField fullWidth size="small" defaultValue={map.name} />
            </FormField>
            <Typography variant="caption" color="text.secondary">
              Name changes save automatically (not yet wired — placeholder).
            </Typography>
          </Stack>
        </PageCard>
      </PageSection>

      <PageSection title="Branding" spacing="tight">
        <PageCard>
          <Stack spacing={2}>
            <FormField
              label="Logo"
              helperText="SVG or PNG, recommended 240×60. Shown in the public viewer header."
            >
              <Button variant="outlined" size="small" sx={{ textTransform: "none", width: "fit-content" }}>
                Upload logo
              </Button>
            </FormField>
            <FormField
              label="Primary color"
              helperText="Used for pins, highlights, and buttons on the public viewer."
            >
              <TextField size="small" defaultValue="#6B9CD8" sx={{ maxWidth: 160 }} />
            </FormField>
          </Stack>
        </PageCard>
      </PageSection>

      <PageSection title="Sharing" spacing="tight">
        <PageCard>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>
            Public Link
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Share this link to let anyone view the interactive campus map.
          </Typography>
          <TextField
            fullWidth
            size="small"
            value={publicUrl}
            slotProps={{
              input: {
                readOnly: true,
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title="Copy link">
                      <IconButton size="small" onClick={() => copy(publicUrl, "url")}>
                        <ContentCopyIcon
                          fontSize="small"
                          sx={{ color: copied === "url" ? "success.main" : undefined }}
                        />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Open in new tab">
                      <IconButton size="small" component={Link} href={publicUrl} target="_blank">
                        <OpenInNewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
              },
            }}
          />
        </PageCard>
      </PageSection>

      <PageSection title="Embed" spacing="tight">
        <PageCard>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>
            Embed Code
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Paste this snippet into any webpage to embed the campus map.
          </Typography>
          <TextField
            fullWidth
            size="small"
            multiline
            rows={3}
            value={embedCode}
            slotProps={{
              input: {
                readOnly: true,
                style: { fontFamily: "monospace", fontSize: "0.8125rem" },
              },
            }}
          />
          <Button
            size="small"
            variant="outlined"
            startIcon={<ContentCopyIcon />}
            onClick={() => copy(embedCode, "embed")}
            sx={{ mt: 1.5, textTransform: "none" }}
          >
            {copied === "embed" ? "Copied!" : "Copy embed code"}
          </Button>
        </PageCard>
      </PageSection>

      <PageSection title="Languages" spacing="tight">
        <PageCard>
          <Typography variant="body2" color="text.secondary">
            Language options will appear here — Greek and English as defaults.
            Coming with the multilingual pass.
          </Typography>
        </PageCard>
      </PageSection>

      <PageSection title="Members" spacing="tight">
        <PageCard>
          <Typography variant="body2" color="text.secondary">
            Invite teammates as Admin, Editor, or Viewer. Coming next.
          </Typography>
        </PageCard>
      </PageSection>
    </Stack>
  );
}
