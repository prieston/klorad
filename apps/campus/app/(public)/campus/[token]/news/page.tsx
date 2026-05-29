import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import { getPublicCampusByToken } from "@/lib/public-campus";
import { detectLocale, pickText } from "@/app/lib/i18n-core";
import {
  listNewsForProject,
  relativeNewsTime,
} from "@/lib/news";
import { readPosts } from "@/lib/posts";
import { ConsumerNav } from "@/lib/consumer/ConsumerNav";
import { SegmentedTabs } from "@/lib/consumer/SegmentedTabs";
import { ConsumerFooter } from "@/lib/consumer/ConsumerFooter";

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
 * Combines `NewsPost` rows with legacy `sceneData.posts` so existing
 * tenants don't lose their content during the migration — same merge
 * the consumer home uses, just unbounded.
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
  const mapHref = `/campus/${token}/map${lang}`;

  const [dbPosts, legacyPosts] = await Promise.all([
    listNewsForProject(map.id, 100),
    Promise.resolve(readPosts(map.sceneData)),
  ]);

  // Merge into one display shape, newest first. Legacy posts use
  // their `?lang` pick; the new model is plain strings.
  const news = [
    ...dbPosts.map((p) => ({
      id: p.id,
      title: p.title,
      body: p.body,
      publishedAt: p.publishedAt,
      anchors: p.anchors,
      detailHref: `/campus/${token}/news/${p.id}${lang}`,
    })),
    ...legacyPosts.map((p) => ({
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
      // Legacy posts don't have detail pages — link to the map with
      // the place focused, or to the home if there's no place.
      detailHref: p.place
        ? `${mapHref}&space=${encodeURIComponent(p.place.id)}`
        : `/campus/${token}${lang}`,
    })),
  ].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));

  return (
    <main data-consumer lang={locale} style={themeStyle}>
      <ConsumerNav
        campusName={campusName}
        logoUrl={branding.logo}
        token={token}
        locale={locale}
      />

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

        {news.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-[var(--brand-line)] bg-white p-8 text-center text-sm text-[var(--brand-text-muted)]">
            No news published yet.
          </div>
        ) : (
          <div className="mt-6">
            {news.map((n) => (
              <article
                key={n.id}
                className="border-b border-[var(--brand-line)] py-5 last:border-b-0"
              >
                <Link href={n.detailHref} className="group block">
                  <h2 className="text-base font-medium text-[var(--brand-text)] transition-colors group-hover:text-[var(--brand-primary)]">
                    {n.title}
                  </h2>
                  <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-[var(--brand-text-muted)]">
                    {n.body}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[0.7rem] uppercase tracking-wide text-[var(--brand-text-muted)]">
                    <span>{relativeNewsTime(n.publishedAt)}</span>
                    {n.anchors[0] ? (
                      <span className="inline-flex items-center gap-1 normal-case tracking-normal">
                        <MapPin size={12} strokeWidth={1.75} />
                        {n.anchors[0].refName}
                      </span>
                    ) : null}
                  </div>
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>

      <ConsumerFooter campusName={campusName} />
    </main>
  );
}
