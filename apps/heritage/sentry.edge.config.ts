import * as Sentry from "@sentry/nextjs";

/**
 * Edge-runtime Sentry init — middleware and any edge route handlers.
 * Heritage runs everything on Node (the ingest probes need Buffer and
 * the AWS SDK), so this is currently a safety net rather than a hot
 * path. Same DSN and sample rate as the server config.
 *
 * Called by `instrumentation.ts` when the runtime is `edge`.
 */
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  environment: process.env.VERCEL_ENV ?? "development",
  tracesSampleRate: 0.1,
});
