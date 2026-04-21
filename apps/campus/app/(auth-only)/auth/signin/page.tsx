"use client";

import { signIn } from "next-auth/react";
import GitHubIcon from "@mui/icons-material/GitHub";
import { GoogleIcon, OAuthSignInCard } from "@klorad/ui";

const PROVIDERS = [
  { id: "google", label: "Google", icon: <GoogleIcon /> },
  { id: "github", label: "GitHub", icon: <GitHubIcon /> },
];

export default function SignInPage() {
  return (
    <OAuthSignInCard
      appName="Campus Maps"
      tagline="Sign in to manage your campus maps"
      providers={PROVIDERS}
      onProviderClick={(id) => signIn(id, { callbackUrl: "/" })}
      legalText="By signing in you agree to our Terms of Service and Privacy Policy."
    />
  );
}
