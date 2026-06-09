/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@klorad/design-system", "@klorad/ui"],
  images: {
    remotePatterns: [
      // Operator-uploaded assets (tenant logos, source thumbnails)
      // live on DigitalOcean Spaces — same convention as Campus.
      { protocol: "https", hostname: "**.digitaloceanspaces.com" },
    ],
  },
};

export default nextConfig;
