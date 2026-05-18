import withBundleAnalyzer from '@next/bundle-analyzer';
import { createRequire } from 'module';
import path from 'path';
const require = createRequire(import.meta.url);
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: '/industries/mobility', destination: '/mobility', permanent: true },
      { source: '/industries/cultural-heritage', destination: '/virtual-heritage', permanent: true },
      { source: '/industries/agriculture', destination: '/urban', permanent: true },
      { source: '/industries/urban-infrastructure', destination: '/urban', permanent: true },
      { source: '/sectors', destination: '/platform', permanent: true },
    ];
  },
  // Image optimization configuration
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.digitaloceanspaces.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'prieston-prod.fra1.digitaloceanspaces.com',
        pathname: '/**',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    // Define compile-time constants for dead-code elimination
    const isDev = process.env.NODE_ENV === 'development';

    config.plugins = config.plugins || [];
    config.plugins.push(
      new webpack.DefinePlugin({
        __DEV__: JSON.stringify(isDev),
        __LOG_LEVEL__: JSON.stringify(isDev ? 'debug' : 'warn'),
        DEBUG_SENSORS: JSON.stringify(false), // Website doesn't use Cesium sensors
      })
    );

    // Copy Prisma query engine binaries for serverless functions
    if (isServer) {
      // Find the Prisma client path in node_modules
      const prismaClientPath = path.join(
        process.cwd(),
        'node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client'
      );

      // Copy binaries to .next/server/.prisma/client so Prisma can find them in serverless functions
      const outputPath = config.output.path || path.join(process.cwd(), '.next/server');
      const prismaOutputPath = path.join(outputPath, '.prisma', 'client');

      config.plugins.push(
        new CopyPlugin({
          patterns: [
            {
              from: path.join(prismaClientPath, 'libquery_engine-rhel-openssl-3.0.x.so.node'),
              to: prismaOutputPath,
              noErrorOnMissing: true,
            },
            {
              from: path.join(prismaClientPath, 'query_engine-rhel-openssl-3.0.x.node'),
              to: prismaOutputPath,
              noErrorOnMissing: true,
            },
          ],
        })
      );
    }

    // Strip console.* in production
    if (!isServer && process.env.NODE_ENV === 'production') {
      const TerserPlugin = require('terser-webpack-plugin');
      config.optimization = {
        ...config.optimization,
        minimizer: [
          ...(config.optimization?.minimizer || []),
          new TerserPlugin({
            terserOptions: {
              compress: {
                drop_console: true,
              },
            },
          }),
        ],
      };
    }
    return config;
  },
};

export default bundleAnalyzer(nextConfig);

