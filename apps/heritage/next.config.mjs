/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@klorad/design-system", "@klorad/ui"],
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
