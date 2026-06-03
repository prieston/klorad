/**
 * Next.js 15 instrumentation hook — runs once per worker per runtime
 * before any user code. Sentry's Next plugin documents this as the
 * canonical entrypoint for the server + edge SDKs (the client SDK is
 * loaded by `sentry.client.config.ts` separately).
 *
 * We import per-runtime to keep the edge runtime's bundle out of the
 * server's tree (and vice versa). Without `SENTRY_DSN`, the init
 * calls inside each module are no-ops; this file is still cheap to
 * load.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Next.js calls this hook for any error raised inside a server
// request lifecycle. Sentry 10 exposes its handler as
// `captureRequestError`; Next expects the export to be called
// `onRequestError`, so re-export it under that name.
export { captureRequestError as onRequestError } from "@sentry/nextjs";
