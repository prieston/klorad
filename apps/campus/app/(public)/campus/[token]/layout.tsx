import type { ReactNode } from "react";
import { getPublicCampusByToken } from "@/lib/public-campus";
import { CampusBottomNav } from "@/lib/consumer/CampusBottomNav";

type Params = Promise<{ token: string }>;

function isValidHex(value: string | undefined): value is string {
  return !!value && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
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
  const accentColor = isValidHex(scene?.branding?.primaryColor)
    ? scene!.branding!.primaryColor
    : undefined;
  // Define `--brand-primary` directly on the wrapper so the bottom
  // nav (sibling of `<main data-consumer>`) inherits a real value.
  // Per-tenant override flows through `accentColor`; default matches
  // the consumer palette in global.css.
  const themeStyle = {
    ["--brand-primary" as string]: accentColor ?? "#534ab7",
  } as React.CSSProperties;

  return (
    <div style={themeStyle}>
      {children}
      <CampusBottomNav token={token} />
    </div>
  );
}
