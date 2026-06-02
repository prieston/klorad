import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { getPublicCampusByToken } from "@/lib/public-campus";
import { CampusBottomNav } from "@/lib/consumer/CampusBottomNav";
import { ConsumerNav } from "@/lib/consumer/ConsumerNav";
import { deriveCampusPalette, paletteToCssVars } from "@/lib/palette";
import { SWRProvider } from "@/lib/swr/SWRProvider";
import { ServiceWorkerRegistrar } from "@/lib/consumer/ServiceWorkerRegistrar";
import { InstallPrompt } from "@/lib/consumer/InstallPrompt";

interface CampusBranding {
  name?: string;
  logo?: string;
  primaryColor?: string;
}

type Params = Promise<{ token: string }>;

function isValidHex(value: string | undefined): value is string {
  return !!value && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}

/**
 * Per-tenant `<head>` metadata — point each campus at its own
 * `manifest.webmanifest` route so the install prompt picks up the
 * campus's name, icon, and theme colour.
 */
export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { token } = await params;
  const map = await getPublicCampusByToken(token);
  return {
    manifest: `/campus/${token}/manifest.webmanifest`,
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: map?.title ?? "Campus",
    },
  };
}

/**
 * Per-tenant viewport — `themeColor` tints the mobile browser
 * chrome (status bar / address bar) so the campus's brand reaches
 * past the page boundary. In Next 15 this lives on `viewport`,
 * not `metadata`.
 */
export async function generateViewport({
  params,
}: {
  params: Params;
}): Promise<Viewport> {
  const { token } = await params;
  const map = await getPublicCampusByToken(token);
  const scene = (map?.sceneData ?? null) as {
    branding?: { primaryColor?: string };
  } | null;
  const themeColor = isValidHex(scene?.branding?.primaryColor)
    ? scene!.branding!.primaryColor!
    : "#534ab7";
  return {
    themeColor,
  };
}

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
 *
 * PWA wiring lives here too — `ServiceWorkerRegistrar` installs
 * `/sw.js` on the first visit, and `InstallPrompt` surfaces the
 * native install card when the browser fires `beforeinstallprompt`.
 * Both are no-ops on desktop / unsupported browsers, so there's no
 * cost when they can't help.
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
  const scene = (map?.sceneData ?? {}) as { branding?: CampusBranding };
  const branding = scene.branding ?? {};
  const campusName = branding.name || map?.title || "Campus";
  // Full derived palette — primary + fill/bg/soft/ink + 3 hue-rotated
  // accents — flows down as CSS vars from a single inline style on
  // the layout wrapper. The bottom nav (sibling of `<main
  // data-consumer>`) inherits the same vars, so the active pill and
  // every consumer surface stays on-brand for the tenant.
  const palette = deriveCampusPalette(branding.primaryColor);
  const themeStyle = paletteToCssVars(palette);

  return (
    <SWRProvider>
      <div style={themeStyle}>
        {/* Skip link — first focusable element so a Tab from the URL
            bar jumps straight to the page content, past the nav. The
            target `#main` lives on each page's content wrapper. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-[var(--brand-primary,#534ab7)] focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
        >
          Skip to content
        </a>
        {/* The desktop top nav is hoisted into the layout so it
            persists across page navigations — the body unmounts on
            each route change but this stays mounted, giving the
            public surface a native-app feel instead of a flash on
            every tap. Map page hides it via its own `data-mappedin`
            full-viewport layout. */}
        <ConsumerNav
          campusName={campusName}
          logoUrl={branding.logo}
          token={token}
        />
        {children}
        <CampusBottomNav token={token} />
        <InstallPrompt />
        <ServiceWorkerRegistrar />
      </div>
    </SWRProvider>
  );
}
