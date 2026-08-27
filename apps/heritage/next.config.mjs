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

export default nextConfig;
