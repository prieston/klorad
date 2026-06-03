import * as Sentry from "@sentry/nextjs";

/**
 * Edge-runtime Sentry init — middleware, edge route handlers. Most
 * of our routes are Node, but the PWA service worker registration
 * lives at the edge. Same DSN, same sample rate as the server
 * config for now.
 *
 * Called by `instrumentation.ts` when the runtime is `edge`.
 */
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  environment: process.env.VERCEL_ENV ?? "development",
  tracesSampleRate: 0.1,
});
