import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@klorad/design-system", "@klorad/ui"],
  async headers() {
    return [
      {
        // §7.4.2: the viewer has to work "in a cross-origin iframe on a page
        // Klorad does not control". Next sets no X-Frame-Options by default,
        // but being explicit means a later global header cannot silently break
        // every embed already pasted into a museum's website.
        source: "/embed/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
          { key: "X-Frame-Options", value: "ALLOWALL" },
        ],
      },
      {
        // Everything else stays unframeable. An embeddable curator console is
        // a clickjacking target, and the two requirements are opposites.
        source: "/org/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      // Curator-uploaded assets (venue logos, object thumbnails, mesh and
      // splat delivery builds) live on DigitalOcean Spaces — same convention
      // as Campus and Mobility.
      { protocol: "https", hostname: "**.digitaloceanspaces.com" },
    ],
  },
};

/**
 * Same wrapper as Campus: injects the runtime hooks from
 * `instrumentation.ts`, tunnels browser events through /monitoring so
 * ad-blockers do not drop them, and uploads sourcemaps only when a token is
 * present. With `SENTRY_DSN` unset the SDK is fully inert, so a clone with no
 * Sentry project still builds and runs.
 *
 * The `/monitoring` tunnel sits under `/`, not `/embed/`, so a museum's
 * embedded viewer never issues a request to a Klorad monitoring path from a
 * page Klorad does not control.
 */
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  tunnelRoute: "/monitoring",
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});
