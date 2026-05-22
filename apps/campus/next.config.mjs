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
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      "mapbox-gl": "mapbox-gl",
    };
    return config;
  },
};

export default nextConfig;
