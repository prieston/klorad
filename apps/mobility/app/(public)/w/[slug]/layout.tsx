import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { InstallPrompt, UpdateAvailablePrompt } from "@klorad/design-system";
import { loadPublicWorldBySlug } from "@/lib/mobility/world-resolver";
import { RegisterWorldSW } from "./RegisterWorldSW";
import { WorldBeacon } from "./WorldBeacon";
import { MobilityBottomNav } from "./MobilityBottomNav";
import { MobilityPullToRefresh } from "./MobilityPullToRefresh";
import { MobilityTopNav } from "./MobilityTopNav";

type Params = Promise<{ slug: string }>;

function isValidHex(value: unknown): value is string {
  return typeof value === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}

/**
 * Per-world `<head>` metadata — each `/w/[slug]` gets its own
 * manifest URL so an install prompt picks up the world's name,
 * icon, theme color, and start_url. The robots tag flips per
 * visibility: `public` is indexable, `linkOnly` opts out so the URL
 * stays unguessable in practice.
 */
export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const world = await loadPublicWorldBySlug(slug);
  if (!world) return { title: "Not found" };

  // iOS ignores manifest icons for home-screen installs — it reads
  // `<link rel="apple-touch-icon">` instead. Without an explicit
  // apple entry, Next.js falls back to `app/icon.png` (the PSMdt
  // mark) and the world's branded logo never lands. Plumb the
  // world's logoUrl into both icon channels so Android (manifest +
  // browser tab) and iOS (apple-touch-icon + home screen) all paint
  // the same brand. SVG vs PNG is handled in the manifest route;
  // the apple channel accepts either.
  const logoUrl =
    typeof world.theme.logoUrl === "string" ? world.theme.logoUrl : null;
  const icons: Metadata["icons"] = logoUrl
    ? {
        icon: [{ url: logoUrl }],
        shortcut: [{ url: logoUrl }],
        apple: [{ url: logoUrl, sizes: "180x180" }],
      }
    : undefined;

  return {
    title: world.name,
    description: world.description ?? `${world.name} — live traffic + transit.`,
    manifest: `/w/${slug}/manifest.webmanifest`,
    icons,
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: world.name,
    },
    robots:
      world.visibility === "public"
        ? { index: true, follow: true }
        : { index: false, follow: false },
  };
}

/**
 * Per-world viewport — `themeColor` paints the browser chrome and
 * (on Android) the splash screen behind the installed PWA.
 */
export async function generateViewport({
  params,
}: {
  params: Params;
}): Promise<Viewport> {
  const { slug } = await params;
  const world = await loadPublicWorldBySlug(slug);
  const themeColor =
    world && isValidHex(world.theme.primaryColor)
      ? world.theme.primaryColor
      : "#0ea5e9";
  return { themeColor };
}

/**
 * Public `/w/[slug]` layout — intentionally bare. No AppShell, no
 * sidebar; this is the stakeholder PWA, not the operator console.
 * The service worker registers with scope `/w/<slug>/` so only the
 * world's surface is intercepted; jumping to a different world or
 * back to the operator app re-enters the standard fetch path.
 */
export default async function WorldPublicLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Params;
}) {
  const { slug } = await params;
  // World name + logo drive the top-nav branding. Draft / gated
  // worlds return null from the anonymous resolver; the top nav
  // falls back to the slug in that case so the header still
  // renders (the page-level access-denied surface takes over
  // below).
  const world = await loadPublicWorldBySlug(slug);
  const logoUrl =
    world && typeof world.theme.logoUrl === "string"
      ? world.theme.logoUrl
      : null;
  const worldName = world?.name ?? slug;
  return (
    <>
      <MobilityTopNav
        slug={slug}
        worldName={worldName}
        logoUrl={logoUrl}
      />
      {children}
      <MobilityBottomNav slug={slug} />
      <MobilityPullToRefresh />
      <InstallPrompt
        storageKey="klorad-mobility-install-dismissed-at"
        title="Install this world"
        subtitle="Add to your home screen for real-time alerts."
      />
      <UpdateAvailablePrompt scope={`/w/${slug}/`} />
      <RegisterWorldSW slug={slug} />
      <WorldBeacon slug={slug} />
    </>
  );
}
