import { NextRequest } from "next/server";

/**
 * Get the base URL from a Next.js request
 * Falls back to NEXTAUTH_URL env var if available, otherwise constructs from request
 * This enables multi-domain support by dynamically detecting the domain
 */
export function getBaseUrl(request: NextRequest): string {
  // Try environment variable first (for backwards compatibility)
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL;
  }

  // Construct from request headers (works for multi-domain setups)
  const protocol = request.headers.get("x-forwarded-proto") || "https";
  const host =
    request.headers.get("host") || request.headers.get("x-forwarded-host");

  if (host) {
    return `${protocol}://${host}`;
  }

  // Fallback (should not happen in production)
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}
