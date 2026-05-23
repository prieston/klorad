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

export default nextConfig;
