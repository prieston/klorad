"use client";

import { signIn } from "next-auth/react";
import { Box, Button, Typography, Paper } from "@mui/material";
import { styled, alpha } from "@mui/material/styles";
import { GoogleIcon } from "@klorad/ui";
import GitHubIcon from "@mui/icons-material/GitHub";

const PageWrapper = styled(Box)({
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(135deg, #0a0d10 0%, #14171a 50%, #1a1f24 100%)",
  padding: 16,
});

const Card = styled(Paper)(({ theme }) => ({
  width: "100%",
  maxWidth: 420,
  padding: theme.spacing(6, 5),
  backgroundColor: "#161B20",
  border: "1px solid rgba(255,255,255,0.05)",
  borderRadius: 12,
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
  borderRadius: 8,
  border: `1px solid ${alpha(theme.palette.primary.main, 0.25)}`,
  backgroundColor: alpha(theme.palette.primary.main, 0.08),
  color: "#fff",
  "&:hover": {
    backgroundColor: alpha(theme.palette.primary.main, 0.16),
  },
}));

export default function SignInPage() {
  return (
    <PageWrapper>
      <Card>
        <Box sx={{ mb: 1, textAlign: "center" }}>
          <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5 }}>
            Campus Maps
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Sign in to manage your campus maps
          </Typography>
        </Box>

        <OAuthButton
          startIcon={<GoogleIcon />}
          onClick={() => signIn("google", { callbackUrl: "/" })}
        >
          Continue with Google
        </OAuthButton>

        <OAuthButton
          startIcon={<GitHubIcon />}
          onClick={() => signIn("github", { callbackUrl: "/" })}
        >
          Continue with GitHub
        </OAuthButton>

        <Typography
          variant="caption"
          color="text.secondary"
          textAlign="center"
          sx={{ mt: 1 }}
        >
          By signing in you agree to our Terms of Service and Privacy Policy.
        </Typography>
      </Card>
    </PageWrapper>
  );
}
