import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, MapPin } from "lucide-react";
import { getPublicCampusByToken } from "@/lib/public-campus";
import { detectLocale } from "@/app/lib/i18n-core";
import {
  formatNewsDate,
  getNewsPost,
} from "@/lib/news";
import { ConsumerNav } from "@/lib/consumer/ConsumerNav";
import { ConsumerFooter } from "@/lib/consumer/ConsumerFooter";

type Params = Promise<{ token: string; id: string }>;

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
  const { token, id } = await params;
  const [map, post] = await Promise.all([
    getPublicCampusByToken(token),
    getNewsPost(id),
  ]);
  if (!post || !map || post.projectId !== map.id) {
    return { title: "News" };
  }
  return {
    title: `${post.title} · News`,
    description: post.body.slice(0, 160),
    openGraph: {
      title: post.title,
      description: post.body.slice(0, 160),
      type: "article",
      images: post.imageUrl ? [post.imageUrl] : undefined,
    },
  };
}

/**
 * `/campus/[token]/news/[id]` — public news detail page.
 *
 * Arc 2 of [[campus-consumer-pivot]]. Renders one `NewsPost` in the
 * consumer visual language (flat cards, pill anchors, Klorad-purple
 * tokens). 404s when the token + id don't match the same campus —
 * the id alone can't leak a post via a different tenant's URL.
 *
 * Anchor chips deep-link into the MappedIn viewer at
 * `/campus/[token]/map?space=<refId>` when an anchor has a MappedIn
 * id; otherwise they render as static labels.
 */
export default async function NewsDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token, id } = await params;
  const sp = await searchParams;
  const locale = detectLocale(typeof sp.lang === "string" ? sp.lang : null);

  const map = await getPublicCampusByToken(token);
  if (!map) notFound();
  const post = await getNewsPost(id);
  if (!post || post.projectId !== map.id) notFound();

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

  return (
    <main data-consumer lang={locale} style={themeStyle}>
      <ConsumerNav
        campusName={campusName}
        logoUrl={branding.logo}
        token={token}
        locale={locale}
      />

      <article className="mx-auto max-w-[760px] px-4 py-8 md:px-6 md:py-12">
        <Link
          href={`/campus/${token}${lang}`}
          className="inline-flex items-center gap-1 text-sm text-[var(--brand-text-muted)] transition-colors hover:text-[var(--brand-primary)]"
        >
          <ChevronLeft size={16} strokeWidth={1.75} />
          Back to {campusName}
        </Link>

        <p className="mt-6 text-xs uppercase tracking-wide text-[var(--brand-text-muted)]">
          {post.category} · {formatNewsDate(post.publishedAt)}
        </p>

        <h1 className="mt-2 text-3xl font-medium leading-tight text-[var(--brand-text)] md:text-4xl">
          {post.title}
        </h1>

        {post.anchors.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {post.anchors.map((a, i) =>
              a.refId ? (
                <Link
                  key={`${a.refId}-${i}`}
                  href={`${mapHref}&space=${encodeURIComponent(a.refId)}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-primary-bg)] px-3 py-1 text-xs font-medium text-[var(--brand-primary)] transition-opacity hover:opacity-80"
                >
                  <MapPin size={14} strokeWidth={1.75} />
                  {a.refName}
                </Link>
              ) : (
                <span
                  key={`${a.refName}-${i}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-primary-bg)] px-3 py-1 text-xs font-medium text-[var(--brand-primary)]"
                >
                  <MapPin size={14} strokeWidth={1.75} />
                  {a.refName}
                </span>
              ),
            )}
          </div>
        ) : null}

        {post.imageUrl ? (
          <div className="mt-8 overflow-hidden rounded-2xl border border-[var(--brand-line)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.imageUrl}
              alt=""
              className="block aspect-[16/9] w-full object-cover"
            />
          </div>
        ) : null}

        <div className="mt-8 whitespace-pre-wrap text-base leading-relaxed text-[var(--brand-text)]">
          {post.body}
        </div>
      </article>

      <ConsumerFooter campusName={campusName} />
    </main>
  );
}
