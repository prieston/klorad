import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@klorad/api",
    "@klorad/core",
    "@klorad/design-system",
    "@klorad/ui",
    "@klorad/engine-mapbox",
    "@klorad/engine-three",
  ],
  // `node-ical` (ICS event parsing) is a Node library that doesn't
  // survive webpack bundling — load it at runtime instead of bundling
  // it into the server output.
  serverExternalPackages: ["node-ical"],
  images: {
    // Uploaded campus assets (hero, thumbnails, branding, floor
    // plans) live on DigitalOcean Spaces — `<bucket>.<region>.
    // digitaloceanspaces.com`. The wildcard covers any region.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.digitaloceanspaces.com",
      },
    ],
  },
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      "mapbox-gl": "mapbox-gl",
    };
    return config;
  },
};

/**
 * `withSentryConfig` wraps the Next config so the SDK can:
 *  - inject server + edge runtime hooks via instrumentation.ts
 *  - tunnel browser events through /monitoring to dodge ad-blockers
 *  - upload sourcemaps (only when SENTRY_AUTH_TOKEN + org + project
 *    are set; without them the wrapper just skips that step)
 *
 * Org + project + auth token are pulled from env so we never commit
 * them. With all three unset, the build still works — Sentry is
 * fully no-op without `SENTRY_DSN` (see sentry.*.config.ts).
 */
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Suppress the wizard-style notice when running locally without a
  // configured org/project — useful for first-time clones.
  silent: !process.env.CI,
  // Browser events route through this Next API path instead of
  // sentry.io so common ad-blockers don't drop them. Sentry's plugin
  // creates the route for us.
  tunnelRoute: "/monitoring",
  // Skip source-map uploads unless we have the auth token; otherwise
  // every build wastes a network call and dirties the deploy log.
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});
