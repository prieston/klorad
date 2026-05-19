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
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      "mapbox-gl": "mapbox-gl",
    };
    return config;
  },
};

export default nextConfig;
