"use client";

import React from "react";
import { Box, Button, Paper, Typography } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";

export interface OAuthProvider {
  id: string;
  label: string;
  icon: React.ReactNode;
}

export interface OAuthSignInCardProps {
  /** App name shown as the main heading. */
  appName: string;
  /** Subtitle under the heading. */
  tagline?: string;
  /** OAuth providers rendered as stacked buttons. */
  providers: OAuthProvider[];
  /** Called with the provider id when clicked. */
  onProviderClick: (providerId: string) => void;
  /** Optional footer legal text (terms, privacy, etc.). */
  legalText?: React.ReactNode;
}

const PageWrapper = styled(Box)(({ theme }) => ({
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: theme.spacing(2),
  background:
    theme.palette.mode === "dark"
      ? "linear-gradient(135deg, #0a0d10 0%, #14171a 50%, #1a1f24 100%)"
      : "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #cbd5e1 100%)",
}));

const Card = styled(Paper)(({ theme }) => ({
  width: "100%",
  maxWidth: 420,
  padding: theme.spacing(6, 5),
  backgroundColor: "#161B20",
  border: "1px solid rgba(255,255,255,0.05)",
  borderRadius: theme.shape.borderRadius,
  boxShadow: "none",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: theme.spacing(2),
}));

const OAuthButton = styled(Button)(({ theme }) => ({
  width: "100%",
  textTransform: "none",
  fontWeight: 500,
  fontSize: "0.9375rem",
  padding: theme.spacing(1.5, 3),
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${alpha(theme.palette.primary.main, 0.25)}`,
  backgroundColor: alpha(theme.palette.primary.main, 0.08),
  color: theme.palette.text.primary,
  "&:hover": {
    backgroundColor: alpha(theme.palette.primary.main, 0.16),
  },
}));

export const OAuthSignInCard: React.FC<OAuthSignInCardProps> = ({
  appName,
  tagline,
  providers,
  onProviderClick,
  legalText,
}) => {
  return (
    <PageWrapper>
      <Card>
        <Box sx={{ mb: 1, textAlign: "center" }}>
          <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5 }}>
            {appName}
          </Typography>
          {tagline && (
            <Typography variant="body2" color="text.secondary">
              {tagline}
            </Typography>
          )}
        </Box>

        {providers.map((p) => (
          <OAuthButton
            key={p.id}
            startIcon={p.icon}
            onClick={() => onProviderClick(p.id)}
          >
            Continue with {p.label}
          </OAuthButton>
        ))}

        {legalText && (
          <Typography
            variant="caption"
            color="text.secondary"
            textAlign="center"
            sx={{ mt: 1 }}
          >
            {legalText}
          </Typography>
        )}
      </Card>
    </PageWrapper>
  );
};
