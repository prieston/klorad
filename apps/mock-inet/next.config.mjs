/** @type {import('next').NextConfig} */
const nextConfig = {
  // Everything is API routes; no server components to speak of. The
  // landing page is static. This keeps the Vercel build tiny.
  reactStrictMode: true,
  // The Parsons/Klorad connector hits `/atms/{s}-rest/rest/{s}/` with
  // an explicit trailing slash and treats a 308 redirect as an error.
  // Skip Next's default trailing-slash normalisation so both variants
  // reach the catch-all handler.
  skipTrailingSlashRedirect: true,
  logging: {
    fetches: {
      // Silence Next's default per-request log spam so the SSE stream
      // doesn't drown out the interesting events.
      fullUrl: false,
    },
  },
};

export default nextConfig;
