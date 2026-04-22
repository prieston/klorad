import { NextResponse } from "next/server";

// Cap how much we're willing to stream back to the browser so a hostile URL
// can't fill our memory or bandwidth. 15 MB is enough for typical floor plan
// renders without being silly.
const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/avif",
];

/**
 * GET /api/image-proxy?url=<absolute http(s) url>
 *
 * Server-side fetches an external image and re-serves it with permissive
 * CORS headers so Mapbox's image source (and `<canvas>.toDataURL()`) can
 * consume it. Used for floor plan overlays that live on third-party CDNs.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const target = searchParams.get("url");

  if (!target) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json({ error: "Only http(s) urls are allowed" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(parsed.toString(), {
      // Don't forward cookies. Keep the proxy stateless.
      redirect: "follow",
      headers: { Accept: "image/*" },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upstream fetch failed" },
      { status: 502 }
    );
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { error: `Upstream returned ${upstream.status}` },
      { status: upstream.status }
    );
  }

  const contentType = (upstream.headers.get("content-type") ?? "image/jpeg")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
    return NextResponse.json(
      { error: `Unsupported content-type: ${contentType}` },
      { status: 415 }
    );
  }

  const contentLength = Number(upstream.headers.get("content-length") ?? 0);
  if (contentLength && contentLength > MAX_BYTES) {
    return NextResponse.json({ error: "Image too large" }, { status: 413 });
  }

  const buf = await upstream.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "Image too large" }, { status: 413 });
  }

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "content-type": contentType,
      // Mapbox and canvas both require a permissive CORS header.
      "access-control-allow-origin": "*",
      // Cache on the CDN / edge for 1 day; revalidate every hour.
      "cache-control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
