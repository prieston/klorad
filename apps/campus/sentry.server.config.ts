import * as Sentry from "@sentry/nextjs";

/**
 * Node-runtime Sentry init. DSN-gated — if `SENTRY_DSN` isn't set
 * the SDK is a no-op. Tracing samples 10% of requests to keep the
 * monthly event budget bounded; flip to a higher rate after the
 * first month of usage data.
 *
 * Called by `instrumentation.ts` when the runtime is `nodejs`.
 * Lives at the app root (not under `app/`) per the Sentry/Next 15
 * convention so the SDK can find it.
 */
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  environment: process.env.VERCEL_ENV ?? "development",
  tracesSampleRate: 0.1,
});
