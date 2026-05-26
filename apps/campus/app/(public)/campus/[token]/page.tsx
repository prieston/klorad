import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicCampusByToken } from "@/lib/public-campus";
import { readHomePage } from "@/lib/home-page";
import { detectLocale, pickText } from "@/app/lib/i18n-core";
import NotPublishedPlaceholder from "./NotPublishedPlaceholder";
import { ConsumerHome } from "@/lib/consumer/ConsumerHome";

type Params = Promise<{ token: string }>;

interface CampusBranding {
  name?: string;
  logo?: string;
  primaryColor?: string;
}

function isValidHex(value: string | undefined): value is string {
  return !!value && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}

/** Dynamic metadata so shared URLs preview nicely. */
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
  const description = `${name} — news, events, clubs and an interactive campus map.`;
  return {
    title: name,
    description,
    openGraph: {
      title: `${name} · Klorad Campus`,
      description,
      type: "website",
      siteName: "Klorad Campus",
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} · Klorad Campus`,
      description,
    },
  };
}

/**
 * `/campus/[token]` — the public campus home page.
 *
 * Arc 1 of [[campus-consumer-pivot]]: the multi-tenant template
 * lands here. Everything visible is now rendered by `ConsumerHome`;
 * per-org `branding.primaryColor` flows in as `accentColor` and
 * overrides the default purple at the `data-consumer` root.
 *
 * Real news / events / clubs land in Arcs 2 – 4. For now the rails
 * are populated by `lib/sample-campus.ts`, shaped to the eventual
 * schema so the markup doesn't change when data sources flip.
 */
export default async function CampusHomePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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
  // The home-page builder lets an org override the marketing copy.
  // When set, those win over the platform's defaults.
  const home = readHomePage(map.sceneData);
  const headline = pickText(home.headline, locale) || undefined;
  const subheading = pickText(home.tagline, locale) || undefined;

  return (
    <ConsumerHome
      token={token}
      campusName={campusName}
      accentColor={accentColor}
      logoUrl={branding.logo}
      locale={locale}
      headline={headline}
      subheading={subheading}
      mapThumbnailUrl={map.thumbnail ?? undefined}
    />
  );
}
