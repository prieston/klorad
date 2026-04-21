"use client";

import { useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  IconButton,
  InputAdornment,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { toast } from "react-toastify";
import Link from "next/link";

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
    <Box sx={{ p: 3, maxWidth: 720 }}>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Map Settings
      </Typography>

      <Card sx={{ bgcolor: "#14171a", border: "1px solid rgba(255,255,255,0.06)", mb: 3 }}>
        <CardContent>
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
                        <ContentCopyIcon fontSize="small" sx={{ color: copied === "url" ? "success.main" : undefined }} />
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
        </CardContent>
      </Card>

      <Card sx={{ bgcolor: "#14171a", border: "1px solid rgba(255,255,255,0.06)" }}>
        <CardContent>
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
            slotProps={{ input: { readOnly: true, style: { fontFamily: "monospace", fontSize: "0.8125rem" } } }}
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
        </CardContent>
      </Card>

      <Divider sx={{ my: 3, borderColor: "rgba(255,255,255,0.06)" }} />

      <Box sx={{ display: "flex", gap: 2 }}>
        <Button
          variant="contained"
          component={Link}
          href={`/org/${orgId}/maps/${mapId}/builder`}
          size="small"
          sx={{ textTransform: "none" }}
        >
          Back to Builder
        </Button>
      </Box>
    </Box>
  );
}
