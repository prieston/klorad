import process from 'process';
import path from 'path';
import { createRequire } from 'module';
import withBundleAnalyzer from '@next/bundle-analyzer';
import withPWA from '@ducanh2912/next-pwa';

const require = createRequire(import.meta.url);
const webpack = require('webpack');

// Handle unhandled rejections during build (e.g., PWA plugin trying to access _document in App Router)
if (typeof process !== 'undefined') {
  process.on('unhandledRejection', (reason, promise) => {
    // Suppress known PWA plugin errors related to _document in App Router
    if (reason && typeof reason === 'object' && 'code' in reason && reason.code === 'ENOENT') {
      const errorMessage = reason.message || String(reason);
      if (errorMessage.includes('_document') || errorMessage.includes('PageNotFoundError')) {
        // This is a known issue with PWA plugin in App Router - log warning but don't fail build
        console.warn('[PWA Plugin] Warning: PWA plugin attempted to access _document (Pages Router only). This is safe to ignore in App Router projects.');
        return;
      }
    }
    // For other unhandled rejections, log them but don't fail the build
    console.warn('[Build] Unhandled rejection:', reason);
  });
}

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

/**
 * A fork of 'next-pwa' that has app directory support
 * @see https://github.com/shadowwalker/next-pwa/issues/424#issuecomment-1332258575
 *
 * Note: The PWA plugin may attempt to access _document during build, which doesn't exist
 * in App Router projects. This is handled by the unhandledRejection handler above.
 */
const pwa = withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  // Ensure compatibility with App Router
  buildExcludes: [/app-build-manifest\.json$/],
  // Skip pages directory checks since we're using App Router
  skipWaiting: true,
  clientsClaim: true,
});

const nextConfig = {
  transpilePackages: [
    '@klorad/design-system',
    '@klorad/ui',
    '@klorad/engine-cesium',
    '@klorad/engine-mapbox',
    '@klorad/engine-three',
    '@klorad/ion-sdk',
    'threebox-plugin',
  ],
  // Optimize output for better performance
  output: 'standalone',
  // Ensure proper asset handling
  assetPrefix: process.env.NODE_ENV === 'production' ? undefined : '',
  // Cesium base URL - must be exported at build time
  env: {
    CESIUM_BASE_URL: '/cesium',
  },
  // Image optimization configuration
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.digitaloceanspaces.com',
        pathname: '/**',
      },
    ],
  },
  webpack(config, { isServer, webpack: _webpack }) {
    // Define compile-time constants for dead-code elimination
    const isDev = process.env.NODE_ENV === 'development';
    const isProd = process.env.NODE_ENV === 'production';

    config.plugins = config.plugins || [];
    config.plugins.push(
      new webpack.DefinePlugin({
        __DEV__: JSON.stringify(isDev),
        __LOG_LEVEL__: JSON.stringify(isDev ? 'debug' : 'warn'),
        DEBUG_SENSORS: JSON.stringify(process.env.DEBUG_SENSORS === 'true'),
      })
    );

    config.resolve = {
      ...config.resolve,
      alias: {
        ...config.resolve?.alias,
        '@': '.',
        // Force single Three.js instance across workspace
        'three': path.resolve(process.cwd(), 'node_modules/three'),
        // Ensure @cesium/engine resolves from editor app's node_modules when transpiling packages
        '@cesium/engine': path.resolve(process.cwd(), 'node_modules/@cesium/engine')
      },
      fallback: {
        ...config.resolve?.fallback,
        fs: false,
        path: false,
        crypto: false,
        stream: false,
        util: false,
      },
    };

    // Mark heavy 3D libraries as external on server to reduce function size
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : [config.externals]),
        'three',
        'cesium',
        '@cesium/engine',
        '@cesium/widgets',
        '@react-three/fiber',
        '@react-three/drei',
        '@react-three/postprocessing',
        '@react-three/rapier',
        '@react-three/xr',
        '3d-tiles-renderer',
        'three-stdlib'
      ];
    } else if (Array.isArray(config.externals)) {
      config.externals.push('sharp');
    }

    // Prevent webpack from parsing Cesium's pre-built chunk files from node_modules
    config.module.rules.push({
      test: /chunk-[A-Z0-9]+\.js$/,
      include: /node_modules/,
      use: ['file-loader'],
      type: 'javascript/auto',
    });

    // Enhanced Cesium asset handling
    config.module.rules.push({
      test: /\.(png|gif|jpg|jpeg|svg|xml|json)$/,
      include: /node_modules\/cesium/,
      use: [{
        loader: 'url-loader',
        options: {
          limit: 8192,
          fallback: {
            loader: 'file-loader',
            options: {
              name: 'static/media/[name].[hash].[ext]',
            },
          },
        },
      }],
    });

    // Handle Cesium CSS files specifically
    config.module.rules.push({
      test: /\.css$/,
      include: /node_modules\/cesium/,
      use: ['style-loader', 'css-loader'],
    });

    // Mapbox GL CSS — same as Cesium (postcss/tailwind pipeline breaks on this file)
    config.module.rules.push({
      test: /\.css$/,
      include: /node_modules\/mapbox-gl/,
      use: ['style-loader', 'css-loader'],
    });

    // Vendored Mapbox stylesheet (imported from app; must bypass postcss/url pipeline)
    config.module.rules.push({
      test: /styles\/vendor\/mapbox-gl\.css$/,
      use: [
        'style-loader',
        {
          loader: 'css-loader',
          options: { url: false },
        },
      ],
    });

    // Handle other CSS files (fallback until packages are split)
    config.module.rules.push({
      test: /\.css$/,
      exclude: [
        /node_modules\/cesium/,
        /node_modules\/mapbox-gl/,
        /styles\/vendor\/mapbox-gl\.css$/,
      ],
      use: [
        'style-loader',
        {
          loader: 'css-loader',
          options: {
            importLoaders: 1,
          },
        },
        'postcss-loader',
      ],
    });

    // Audio file handling
    config.module.rules.push({
      test: /\.(ogg|mp3|wav|mpe?g)$/i,
      exclude: config.exclude,
      use: [
        {
          loader: 'url-loader',
          options: {
            limit: config.inlineImageLimit,
            fallback: 'file-loader',
            publicPath: `${config.assetPrefix}/_next/static/images/`,
            outputPath: `${isServer ? '../' : ''}static/images/`,
            name: '[name]-[hash].[ext]',
            esModule: config.esModule || false,
          },
        },
      ],
    });

    // Shader file handling
    config.module.rules.push({
      test: /\.(glsl|vs|fs|vert|frag)$/,
      exclude: /node_modules/,
      use: ['raw-loader', 'glslify-loader'],
    });

    // Note: Cesium assets are generated at build time via CopyWebpackPlugin
    // Assets are copied to public/cesium/ but not committed (in .gitignore)

    // Extra minification only — do not override splitChunks / runtimeChunk: custom vendor/cesium/three
    // splits + runtimeChunk:false break Next 15’s client manifest (undefined module factories in main-app).
    if (!isServer && process.env.NODE_ENV === 'production') {
      const TerserPlugin = require('terser-webpack-plugin');
      config.optimization = {
        ...config.optimization,
        minimizer: [
          ...(config.optimization?.minimizer || []),
          new TerserPlugin({
            terserOptions: {
              compress: {
                drop_console: false,
              },
            },
          }),
        ],
      };
    }

    return config;
  },
};

const KEYS_TO_OMIT = ['webpackDevMiddleware', 'configOrigin', 'target', 'analyticsId', 'webpack5', 'amp', 'assetPrefix'];

export default (_phase, { defaultConfig }) => {
  const plugins = [[pwa], [bundleAnalyzer, {}]];

  let wConfig;
  try {
    wConfig = plugins.reduce((acc, [plugin, config]) => {
      try {
        return plugin({ ...acc, ...config });
      } catch (error) {
        // Handle PWA plugin errors gracefully
        if (error && typeof error === 'object' && 'message' in error) {
          const errorMessage = String(error.message);
          if (errorMessage.includes('_document') || errorMessage.includes('PageNotFoundError')) {
            console.warn('[PWA Plugin] Warning: PWA plugin error related to _document. Continuing with build...');
            return acc; // Return previous config if PWA plugin fails
          }
        }
        throw error; // Re-throw other errors
      }
    }, {
      ...defaultConfig,
      ...nextConfig,
    });
  } catch (error) {
    // If plugin initialization fails completely, fall back to base config
    console.warn('[Build] Plugin initialization error:', error);
    wConfig = {
      ...defaultConfig,
      ...nextConfig,
    };
  }

  const finalConfig = {};
  Object.keys(wConfig).forEach((key) => {
    if (!KEYS_TO_OMIT.includes(key)) {
      finalConfig[key] = wConfig[key];
    }
  });

  return finalConfig;
};