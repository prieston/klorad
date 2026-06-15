"use client";

import { signIn } from "next-auth/react";
import { Button, Panel } from "@klorad/design-system";

const PROVIDERS = [
  { id: "google", label: "Google", icon: <GoogleIcon /> },
  { id: "github", label: "GitHub", icon: <GitHubIcon /> },
];

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-6 text-text-primary">
      <Panel className="w-full max-w-sm rounded-2xl p-6">
        <div className="flex flex-col items-center text-center">
          {/* Square PSMdt mark with the asterisk + "DIGITAL TWINS"
              tag baked in. Plain <img> keeps the static asset on
              the same render path it ships from `/public`. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/psm-mark.png"
            alt="PSMdt Digital Twins"
            className="h-14 w-auto"
          />
          <h1 className="mt-4 text-lg font-semibold text-text-primary">
            Mobility
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Sign in to manage your traffic-management devices
          </p>
        </div>

        <div className="mt-6 space-y-2">
          {PROVIDERS.map((p) => (
            <Button
              key={p.id}
              variant="secondary"
              className="w-full"
              onClick={() => signIn(p.id, { callbackUrl: "/org" })}
            >
              {p.icon}
              Continue with {p.label}
            </Button>
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-text-tertiary">
          By signing in you agree to our Terms of Service and Privacy Policy.
        </p>
      </Panel>
    </div>
  );
}

function GitHubIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M12 1a11 11 0 0 0-3.48 21.44c.55.1.75-.24.75-.53v-2c-3.07.67-3.72-1.31-3.72-1.31-.5-1.28-1.23-1.62-1.23-1.62-1-.69.08-.67.08-.67 1.11.08 1.7 1.14 1.7 1.14.99 1.7 2.6 1.21 3.23.93.1-.72.39-1.21.7-1.49-2.45-.28-5.03-1.23-5.03-5.46 0-1.21.43-2.2 1.13-2.97-.11-.28-.49-1.4.11-2.92 0 0 .93-.3 3.05 1.14a10.65 10.65 0 0 1 5.55 0c2.11-1.44 3.04-1.14 3.04-1.14.61 1.52.22 2.64.11 2.92.71.77 1.13 1.76 1.13 2.97 0 4.25-2.58 5.18-5.04 5.45.4.34.76 1.02.76 2.05v3.04c0 .29.2.64.76.53A11 11 0 0 0 12 1Z"
      />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
