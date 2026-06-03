"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

interface Props {
  error: Error & { digest?: string };
}

/**
 * App-Router global error boundary — Next renders this when a render
 * blows up below the root layout. The Sentry SDK doesn't see it
 * automatically (it lives outside the request lifecycle), so we
 * forward it explicitly here. Cheap when no DSN is set: the SDK
 * is a no-op and `captureException` does nothing.
 *
 * The user-facing message is intentionally minimal — we don't want
 * to leak stack traces in production, but we want the page to look
 * deliberate rather than broken.
 */
export default function GlobalError({ error }: Props) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body
        style={{
          fontFamily:
            'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          background: "#0b1116",
          color: "#e9eef3",
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 12px" }}>
            Something broke on our end.
          </h1>
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.55,
              color: "#9aa5b1",
              margin: "0 0 20px",
            }}
          >
            We&rsquo;ve been notified and are taking a look. Try again, or
            head back to the dashboard.
          </p>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            // Plain anchor on purpose: this boundary renders when the
            // React tree itself has died, so a full document reload is
            // the correct recovery — soft navigation would re-mount
            // into the same broken state.
            href="/"
            style={{
              display: "inline-block",
              background: "#158ca3",
              color: "#ffffff",
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
              padding: "10px 18px",
              borderRadius: 999,
            }}
          >
            Go home
          </a>
        </div>
      </body>
    </html>
  );
}
