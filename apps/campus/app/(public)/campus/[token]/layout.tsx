import type { ReactNode } from "react";
import { getPublicCampusByToken } from "@/lib/public-campus";
import { CampusBottomNav } from "@/lib/consumer/CampusBottomNav";
import { deriveCampusPalette, paletteToCssVars } from "@/lib/palette";
import { SWRProvider } from "@/lib/swr/SWRProvider";

type Params = Promise<{ token: string }>;

/**
 * Shared layout for every `/campus/[token]` route — mounts the
 * mobile bottom nav so the four primary tabs (Home / Map / Explore /
 * Klio) are always reachable, regardless of which page the visitor
 * landed on. Hidden on desktop where `ConsumerNav` carries the same
 * destinations.
 *
 * The layout fetches campus branding too (cached lookup, same call
 * the home page makes — no extra DB hit) so we can hoist the
 * per-tenant accent colour up here. That gives **both** the page
 * content and the bottom nav the same `--brand-primary`, so the
 * active pill stays on-brand for every campus.
 */
export default async function CampusPublicLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Params;
}) {
  const { token } = await params;
  const map = await getPublicCampusByToken(token);
  const scene = (map?.sceneData ?? null) as {
    branding?: { primaryColor?: string };
  } | null;
  // Full derived palette — primary + fill/bg/soft/ink + 3 hue-rotated
  // accents — flows down as CSS vars from a single inline style on
  // the layout wrapper. The bottom nav (sibling of `<main
  // data-consumer>`) inherits the same vars, so the active pill and
  // every consumer surface stays on-brand for the tenant.
  const palette = deriveCampusPalette(scene?.branding?.primaryColor);
  const themeStyle = paletteToCssVars(palette);

  return (
    <SWRProvider>
      <div style={themeStyle}>
        {/* Skip link — first focusable element so a Tab from the URL
            bar jumps straight to the page content, past the nav. Each
            page renders `<main id="main">` so the target always
            exists. Hidden visually until focused. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-[var(--brand-primary,#534ab7)] focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
        >
          Skip to content
        </a>
        {children}
        <CampusBottomNav token={token} />
      </div>
    </SWRProvider>
  );
}
