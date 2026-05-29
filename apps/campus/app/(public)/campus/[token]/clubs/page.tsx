import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicCampusByToken } from "@/lib/public-campus";
import { detectLocale } from "@/app/lib/i18n-core";
import { listTopClubsForProject } from "@/lib/clubs-db";
import { ConsumerNav } from "@/lib/consumer/ConsumerNav";
import { SegmentedTabs } from "@/lib/consumer/SegmentedTabs";
import { ConsumerFooter } from "@/lib/consumer/ConsumerFooter";
import { ClubsListClient } from "@/lib/consumer/ClubsListClient";

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
    title: `Clubs · ${name}`,
    description: `Student clubs and societies at ${name}.`,
  };
}

/**
 * `/campus/[token]/clubs` — public clubs list.
 *
 * Larger than the home's rail — every club on campus, ranked by
 * activity. Each card links to its detail page; the View pill opens
 * the club's external link (Discord / Insta / …) in a new tab.
 */
export default async function ClubsPage({
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
  const clubs = await listTopClubsForProject(map.id, 50);

  return (
    <main id="main" data-consumer lang={locale} style={themeStyle}>
      <ConsumerNav
        campusName={campusName}
        logoUrl={branding.logo}
        token={token}
        locale={locale}
      />

      <section className="mx-auto max-w-[1280px] px-4 py-8 md:px-6 md:py-12">
        <h1 className="text-3xl font-medium text-[var(--brand-text)]">
          Explore
        </h1>
        <SegmentedTabs
          token={token}
          lang={lang}
          locale={locale}
          active="clubs"
        />
        <p className="mt-4 text-sm text-[var(--brand-text-muted)]">
          Student societies, sport clubs, interest groups — ranked by
          activity.
        </p>

        <ClubsListClient
          token={token}
          locale={locale}
          lang={lang}
          initialClubs={clubs}
          emptyCopy="No clubs published yet."
        />
      </section>

      <ConsumerFooter campusName={campusName} />
    </main>
  );
}
