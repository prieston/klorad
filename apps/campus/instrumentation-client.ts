import * as Sentry from "@sentry/nextjs";

/**
 * Browser-side Sentry init. DSN-gated — if `NEXT_PUBLIC_SENTRY_DSN`
 * isn't set at build time the SDK is a no-op (no events sent, no
 * network calls). Sample rates are conservative: every error, 10% of
 * transactions, no session replays by default. Bump replay sample
 * rates only after we've decided what to ingest.
 *
 * `NEXT_PUBLIC_*` because Next inlines this at build time — server-
 * only `SENTRY_DSN` would be `undefined` here. Vercel projects can
 * keep one DSN per environment and feed it to both this build-time
 * variable and the server-only one.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
  tracesSampleRate: 0.1,
  // Replays are off until product decides what to capture. Setting
  // both to 0 keeps the integration listed but inert; flip to e.g.
  // 0.1 + 1.0 to start gathering only sessions that hit an error.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
});

// Forwards App-Router navigation events to Sentry so transitions
// show up alongside server traces. Required by @sentry/nextjs 10+
// when you want client navigation to count as a span.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
