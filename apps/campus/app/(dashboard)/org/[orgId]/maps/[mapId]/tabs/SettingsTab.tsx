"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import useSWR, { mutate } from "swr";
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
import type { Branding, SceneData } from "@klorad/api";

interface Props {
  orgId: string;
  mapId: string;
  map: {
    id: string;
    name: string;
  };
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface ServerMap {
  id: string;
  name: string;
  sceneData?: Partial<SceneData>;
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

  // Load current branding from the saved sceneData
  const { data: serverMap } = useSWR<ServerMap>(`/api/maps/${mapId}`, fetcher);
  const [branding, setBranding] = useState<Branding>({});
  const [savingBrand, setSavingBrand] = useState(false);

  useEffect(() => {
    if (serverMap?.sceneData?.branding) setBranding(serverMap.sceneData.branding);
  }, [serverMap]);

  const handleSaveBranding = async () => {
    setSavingBrand(true);
    try {
      const nextSceneData: Partial<SceneData> = {
        ...(serverMap?.sceneData ?? {}),
        branding,
      };
      const res = await fetch(`/api/maps/${mapId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneData: nextSceneData }),
      });
      if (!res.ok) throw new Error("Save failed");
      await mutate(`/api/maps/${mapId}`);
      toast.success("Branding saved");
    } catch {
      toast.error("Could not save branding");
    } finally {
      setSavingBrand(false);
    }
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
              label="Public display name"
              helperText="Overrides the campus name in the public viewer header. Leave blank to use the campus name above."
            >
              <TextField
                fullWidth
                size="small"
                placeholder={map.name}
                value={branding.name ?? ""}
                onChange={(e) => setBranding((b) => ({ ...b, name: e.target.value }))}
              />
            </FormField>
            <FormField
              label="Logo URL"
              helperText="Paste a public URL to your university's logo (SVG or PNG, roughly 240×60). Shown top-left on the public viewer."
            >
              <TextField
                fullWidth
                size="small"
                placeholder="https://…/logo.svg"
                value={branding.logo ?? ""}
                onChange={(e) => setBranding((b) => ({ ...b, logo: e.target.value }))}
              />
            </FormField>
            <FormField
              label="Primary color"
              helperText="Hex code (e.g. #6B9CD8). Recolors pins, routes, buttons, and highlights on the public viewer."
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  size="small"
                  placeholder="#6B9CD8"
                  sx={{ maxWidth: 180 }}
                  value={branding.primaryColor ?? ""}
                  onChange={(e) =>
                    setBranding((b) => ({ ...b, primaryColor: e.target.value }))
                  }
                />
                {branding.primaryColor && (
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 4,
                      backgroundColor: branding.primaryColor,
                      border: "1px solid rgba(255,255,255,0.12)",
                    }}
                  />
                )}
              </Stack>
            </FormField>

            {branding.logo && (
              <div>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
                  Logo preview
                </Typography>
                <div
                  style={{
                    padding: "16px 20px",
                    borderRadius: 4,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(0,0,0,0.25)",
                    display: "flex",
                    alignItems: "center",
                    width: "fit-content",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={branding.logo}
                    alt="Logo preview"
                    style={{ maxHeight: 40, maxWidth: 280, display: "block" }}
                  />
                </div>
              </div>
            )}

            <div>
              <Button
                variant="contained"
                size="small"
                onClick={handleSaveBranding}
                disabled={savingBrand}
                sx={{ textTransform: "none" }}
              >
                {savingBrand ? "Saving…" : "Save branding"}
              </Button>
            </div>
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
