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

  // Browsers want at least one ≥192px icon for the install prompt.
  // The world's uploaded logo (if any) is preferred; we declare
  // `sizes: "any"` so a non-square upload still installs. The Klorad
  // mark stays as a fallback so installability holds before the
  // operator uploads custom branding (theming arrives in PR4).
  const icons: Array<{ src: string; sizes: string; type?: string; purpose?: string }> = [];
  if (logo) {
    icons.push({ src: logo, sizes: "any", purpose: "any" });
  }
  icons.push({
    src: "/psm-mark.png",
    sizes: "any",
    type: "image/png",
    purpose: "any",
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
