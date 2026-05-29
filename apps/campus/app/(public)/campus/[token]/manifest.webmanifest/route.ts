import { NextResponse } from "next/server";
import { getPublicCampusByToken } from "@/lib/public-campus";

type Params = Promise<{ token: string }>;

interface CampusBranding {
  name?: string;
  logo?: string;
  primaryColor?: string;
}

function isValidHex(value: string | undefined): value is string {
  return !!value && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max - 1).trimEnd() + "…";
}

/**
 * Per-tenant Web App Manifest. Each `/campus/[token]` route gets its
 * own manifest URL so the install prompt picks up the campus's
 * branding (name + theme colour + logo), the home screen icon points
 * back at *that* campus, and the standalone start URL drops the
 * visitor on the campus's home — not Klorad's.
 *
 * Anonymous public lookup — same cached call the home page makes —
 * so this route doesn't add a DB hit per install. The 404 fall
 * through means an unknown token won't pollute the cache with a
 * generic manifest.
 *
 * `scope` is set to the campus subtree so the SW only intercepts
 * navigations inside that tenant; jumping to another tenant exits
 * the installed app surface.
 */
export async function GET(
  _req: Request,
  { params }: { params: Params },
) {
  const { token } = await params;
  const map = await getPublicCampusByToken(token);
  if (!map) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const scene = (map.sceneData ?? {}) as { branding?: CampusBranding };
  const branding = scene.branding ?? {};
  const name = branding.name || map.title || "Campus";
  const themeColor = isValidHex(branding.primaryColor)
    ? branding.primaryColor
    : "#534ab7";

  // Browsers want at least one 192×192-or-larger icon for the install
  // prompt. The campus logo (if uploaded) is usually a good fit; we
  // declare `sizes: "any"` so the browser doesn't second-guess us
  // when the upload isn't a perfect square. Always include the Klorad
  // favicon (302×302) as a fallback so installability holds even
  // before the rector uploads a logo.
  const icons: Array<{
    src: string;
    sizes: string;
    type?: string;
    purpose?: string;
  }> = [];
  if (branding.logo) {
    icons.push({
      src: branding.logo,
      sizes: "any",
      purpose: "any",
    });
  }
  icons.push({
    src: "/klorad-favicon.png",
    sizes: "302x302",
    type: "image/png",
    purpose: "any",
  });

  const manifest = {
    name,
    short_name: truncate(name, 12),
    description: map.description || `${name} — campus map and life`,
    start_url: `/campus/${token}`,
    scope: `/campus/${token}/`,
    display: "standalone",
    orientation: "portrait",
    theme_color: themeColor,
    background_color: "#ffffff",
    icons,
    lang: "en",
    categories: ["education", "navigation", "utilities"],
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
