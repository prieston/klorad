"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

interface Props {
  error: Error & { digest?: string };
}

/**
 * App-Router global error boundary — rendered when a render blows up below the
 * root layout. Sentry does not see this automatically, since it happens
 * outside the request lifecycle, so it is forwarded explicitly. Inert when no
 * DSN is set.
 *
 * Worth more care here than in an internal tool: the page that breaks may be a
 * museum's exhibit, open in a gallery on a wall-mounted screen, or embedded in
 * a journalist's article. So the copy avoids implying the visitor did
 * something wrong, offers the venue rather than an admin dashboard, and the
 * styles are inline because a failure this deep may have taken the stylesheet
 * with it.
 */
export default function GlobalError({ error }: Props) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
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
        <main style={{ maxWidth: 460, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 12px" }}>
            This didn&rsquo;t load.
          </h1>
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              color: "#9aa5b1",
              margin: "0 0 22px",
            }}
          >
            Something failed on our side, not yours. The problem has been
            reported. Reloading often works — the collection itself is fine.
          </p>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            // A plain anchor, deliberately: this boundary renders when the
            // React tree has died, so a full document reload is the only real
            // recovery. Soft navigation would re-mount into the same wreckage.
            href="/"
            style={{
              display: "inline-block",
              background: "#158ca3",
              color: "#ffffff",
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
              padding: "10px 20px",
              borderRadius: 999,
            }}
          >
            Reload
          </a>
        </main>
      </body>
    </html>
  );
}
