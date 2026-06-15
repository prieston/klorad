/**
 * Per-world Web App Manifest. Each `/w/[slug]` gets its own
 * manifest so the install prompt resolves to the world's identity
 * (name, theme color, icon, start_url), not Klorad Mobility's. The
 * `scope` is set to the world's subtree, which means once installed
 * the PWA only intercepts navigations inside `/w/<slug>/`. Jumping
 * to a different world cleanly exits the installed surface.
 */
import { NextResponse } from "next/server";
import { loadPublicWorldBySlug } from "@/lib/mobility/world-resolver";

type Params = Promise<{ slug: string }>;

function isValidHex(value: unknown): value is string {
  return typeof value === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max - 1).trimEnd() + "…";
}

/** Strip query string / fragment and take the extension for MIME
 *  detection. URLs from DO Spaces sometimes carry signed-URL params,
 *  but the file extension is stable. */
function mimeFromUrl(url: string): string | null {
  const cleaned = url.split(/[?#]/)[0].toLowerCase();
  if (cleaned.endsWith(".svg")) return "image/svg+xml";
  if (cleaned.endsWith(".png")) return "image/png";
  if (cleaned.endsWith(".jpg") || cleaned.endsWith(".jpeg")) return "image/jpeg";
  if (cleaned.endsWith(".webp")) return "image/webp";
  return null;
}

export async function GET(
  _req: Request,
  { params }: { params: Params },
): Promise<NextResponse> {
  const { slug } = await params;
  const world = await loadPublicWorldBySlug(slug);
  if (!world) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const themeColor = isValidHex(world.theme.primaryColor)
    ? world.theme.primaryColor
    : "#0ea5e9";
  const backgroundColor = isValidHex(world.theme.backgroundColor)
    ? world.theme.backgroundColor
    : "#0b1220";
  const logo = typeof world.theme.logoUrl === "string" ? world.theme.logoUrl : null;

  // Chrome's install checker silently drops icons that don't declare
  // a `type` matching the file, and `sizes: "any"` is only valid for
  // SVG. Without those, the world's uploaded logo gets skipped and
  // the install falls through to the PSM fallback — which is exactly
  // the regression operators have been hitting after switching from
  // SVG to PNG uploads.
  //
  // We claim space-separated 192x192/512x512 on raster uploads so
  // Chrome picks the right size for both the install prompt and the
  // splash screen, regardless of the upload's actual pixel dims.
  // `purpose: "any maskable"` lets Android use it as an adaptive icon
  // (Pixel/Samsung rounded squircles) without rejecting non-square
  // sources.
  const icons: Array<{ src: string; sizes: string; type?: string; purpose?: string }> = [];
  if (logo) {
    const mime = mimeFromUrl(logo);
    if (mime === "image/svg+xml") {
      icons.push({
        src: logo,
        sizes: "any",
        type: mime,
        purpose: "any maskable",
      });
    } else if (mime) {
      icons.push({
        src: logo,
        sizes: "192x192 512x512",
        type: mime,
        purpose: "any maskable",
      });
    } else {
      // Unknown extension — give the browser something to try; Chrome
      // is forgiving when `type` is omitted on a generic entry.
      icons.push({ src: logo, sizes: "192x192 512x512", purpose: "any" });
    }
  }
  icons.push({
    src: "/psm-mark.png",
    sizes: "192x192 512x512",
    type: "image/png",
    purpose: "any maskable",
  });

  const manifest = {
    name: world.name,
    short_name: truncate(world.name, 12),
    description: world.description ?? `${world.name} — live traffic + transit.`,
    start_url: `/w/${slug}`,
    scope: `/w/${slug}/`,
    display: "standalone",
    orientation: "portrait",
    theme_color: themeColor,
    background_color: backgroundColor,
    icons,
    lang: "en",
    categories: ["navigation", "travel", "utilities"],
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
