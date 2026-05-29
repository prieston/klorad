import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicCampusByToken } from "@/lib/public-campus";
import { detectLocale } from "@/app/lib/i18n-core";
import { ConsumerNav } from "@/lib/consumer/ConsumerNav";
import { KlioPanel } from "@/lib/consumer/KlioPanel";
import NotPublishedPlaceholder from "../NotPublishedPlaceholder";

type Params = Promise<{ token: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

interface CampusBranding {
  name?: string;
  logo?: string;
  primaryColor?: string;
}

function isValidHex(value: string | undefined): value is string {
  return !!value && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { token } = await params;
  const map = await getPublicCampusByToken(token);
  const scene = (map?.sceneData ?? null) as {
    branding?: { name?: string };
  } | null;
  const name = scene?.branding?.name || map?.title || "Campus";
  return {
    title: `Klio · ${name}`,
    description: `Ask Klio, the ${name} campus assistant.`,
  };
}

/**
 * `/campus/[token]/klio` — full-screen chat with Klio, the campus
 * assistant. Mounted as a peer of Home / Map / Explore in the mobile
 * bottom nav.
 */
export default async function KlioPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const locale = detectLocale(typeof sp.lang === "string" ? sp.lang : null);

  const map = await getPublicCampusByToken(token);
  if (!map) notFound();
  if (!map.isPublished)
    return <NotPublishedPlaceholder name={map.title} locale={locale} />;

  const scene = (map.sceneData ?? {}) as { branding?: CampusBranding };
  const branding = scene.branding ?? {};
  const campusName = branding.name || map.title;
  const accentColor = isValidHex(branding.primaryColor)
    ? branding.primaryColor
    : undefined;
  const themeStyle = accentColor
    ? ({ ["--brand-primary" as string]: accentColor } as React.CSSProperties)
    : undefined;
  const lang = `?lang=${locale}`;

  return (
    <main id="main" data-consumer lang={locale} style={themeStyle}>
      <ConsumerNav
        campusName={campusName}
        logoUrl={branding.logo}
        token={token}
        locale={locale}
      />
      <KlioPanel
        mapId={map.id}
        campusName={campusName}
        locale={locale}
        mapHref={`/campus/${token}/map${lang}`}
      />
    </main>
  );
}
