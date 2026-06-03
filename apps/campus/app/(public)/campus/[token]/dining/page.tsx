import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicCampusByToken } from "@/lib/public-campus";
import { detectLocale, pickDefaultLocale } from "@/app/lib/i18n-core";
import { listDiningForProject } from "@/lib/dining-db";
import { SegmentedTabs } from "@/lib/consumer/SegmentedTabs";
import { ConsumerFooter } from "@/lib/consumer/ConsumerFooter";
import { DiningListClient } from "@/lib/consumer/DiningListClient";

type Params = Promise<{ token: string }>;

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
    title: `Dining · ${name}`,
    description: `Where to eat on the ${name} campus — cafes, cafeterias, hours.`,
  };
}

/**
 * `/campus/[token]/dining` — public dining list.
 *
 * Arc 5 of [[campus-consumer-pivot]]. A single page that holds the
 * whole list — no per-location detail page (each row is small
 * enough). Cards grid: 2 columns at md+, 1 on mobile.
 */
export default async function DiningPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const map = await getPublicCampusByToken(token);
  if (!map) notFound();

  const scene = (map.sceneData ?? {}) as {
    branding?: CampusBranding;
    defaultLocale?: unknown;
  };
  const locale = detectLocale(
    typeof sp.lang === "string" ? sp.lang : null,
    pickDefaultLocale(scene.defaultLocale),
  );
  const branding = scene.branding ?? {};
  const campusName = branding.name || map.title;
  const accentColor = isValidHex(branding.primaryColor)
    ? branding.primaryColor
    : undefined;
  const themeStyle = accentColor
    ? ({ ["--brand-primary" as string]: accentColor } as React.CSSProperties)
    : undefined;

  const lang = `?lang=${locale}`;
  const mapHref = `/campus/${token}/map${lang}`;
  const locations = await listDiningForProject(map.id);

  return (
    <main id="main" data-consumer lang={locale} style={themeStyle}>

      <section className="mx-auto max-w-[1280px] px-4 py-8 md:px-6 md:py-12">
        <h1 className="text-3xl font-medium text-[var(--brand-text)]">
          Explore
        </h1>
        <SegmentedTabs
          token={token}
          lang={lang}
          locale={locale}
          active="dining"
        />
        <p className="mt-4 text-sm text-[var(--brand-text-muted)]">
          Where to eat on campus.
        </p>

        <DiningListClient
          token={token}
          locale={locale}
          mapHref={mapHref}
          initialLocations={locations}
          emptyCopy="No dining published yet."
        />
      </section>

      <ConsumerFooter campusName={campusName} />
    </main>
  );
}
