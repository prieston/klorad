"use client";

import { useState } from "react";
import {
  Box,
  Button,
  IconButton,
  InputAdornment,
  Tooltip,
  Typography,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { toast } from "react-toastify";
import Link from "next/link";
import { Page, PageHeader, PageContent, PageSection, PageCard, TextField } from "@klorad/ui";

interface Props {
  orgId: string;
  mapId: string;
}

export default function SettingsClient({ orgId, mapId }: Props) {
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
    <Page>
      <PageHeader
        title="Map Settings"
        breadcrumbs={[
          { label: "Maps", href: `/org/${orgId}/maps` },
          { label: "Settings" },
        ]}
      />
      <PageContent>
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

        <Box sx={{ mt: 4 }}>
          <Button
            variant="contained"
            component={Link}
            href={`/org/${orgId}/maps/${mapId}/builder`}
            size="small"
          >
            Back to Builder
          </Button>
        </Box>
      </PageContent>
    </Page>
  );
}
