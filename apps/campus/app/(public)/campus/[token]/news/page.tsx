import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicCampusByToken } from "@/lib/public-campus";
import { detectLocale, pickDefaultLocale, pickText } from "@/app/lib/i18n-core";
import { listNewsForProject } from "@/lib/news";
import { readPosts } from "@/lib/posts";
import { SegmentedTabs } from "@/lib/consumer/SegmentedTabs";
import { ConsumerFooter } from "@/lib/consumer/ConsumerFooter";
import { NewsListClient } from "@/lib/consumer/NewsListClient";

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
    title: `News · ${name}`,
    description: `Latest announcements and updates from the ${name} campus.`,
  };
}

/**
 * `/campus/[token]/news` — public news list.
 *
 * Hybrid SSR + SWR. The page fetches the initial DB news set
 * server-side (fast first paint, SEO-correct markup), then hands
 * off to `NewsListClient` which manages cross-mount cache hits and
 * background revalidation via `useCampusNews`. Legacy
 * `sceneData.posts` are read server-side and passed in
 * pre-formatted — they're static per request, so SWR doesn't need
 * to track them.
 */
export default async function NewsPage({
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

  const [dbPosts, legacyPostsRaw] = await Promise.all([
    listNewsForProject(map.id, 100),
    Promise.resolve(readPosts(map.sceneData)),
  ]);
  const legacy = legacyPostsRaw.map((p) => ({
    id: p.id,
    title: pickText(p.title, locale) || "",
    body: pickText(p.body, locale) || "",
    publishedAt: p.publishedAt,
    anchors: p.place
      ? [
          {
            kind: (p.place.kind === "room" ? "room" : "building") as
              | "room"
              | "building",
            refId: p.place.id,
            refName: p.place.name,
          },
        ]
      : [],
    detailHref: p.place
      ? `${mapHref}&space=${encodeURIComponent(p.place.id)}`
      : `/campus/${token}${lang}`,
  }));

  return (
    <main id="main" data-consumer lang={locale} style={themeStyle}>

      <section className="mx-auto max-w-[820px] px-4 py-8 md:px-6 md:py-12">
        <h1 className="text-3xl font-medium text-[var(--brand-text)]">
          Explore
        </h1>
        <SegmentedTabs
          token={token}
          lang={lang}
          locale={locale}
          active="news"
        />
        <p className="mt-4 text-sm text-[var(--brand-text-muted)]">
          Announcements, updates, and alerts.
        </p>

        <NewsListClient
          token={token}
          locale={locale}
          lang={lang}
          initialNews={dbPosts}
          legacy={legacy}
          emptyCopy="No news published yet."
        />
      </section>

      <ConsumerFooter campusName={campusName} />
    </main>
  );
}
