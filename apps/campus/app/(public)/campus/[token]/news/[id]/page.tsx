import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, MapPin } from "lucide-react";
import { getPublicCampusByToken } from "@/lib/public-campus";
import { detectLocale, pickLocalized } from "@/app/lib/i18n-core";
import {
  formatNewsDate,
  getNewsPost,
  type NewsCategory,
} from "@/lib/news";
import { ConsumerNav } from "@/lib/consumer/ConsumerNav";
import { ConsumerFooter } from "@/lib/consumer/ConsumerFooter";
import { ShareButton } from "@/lib/consumer/ShareButton";
import { stripedBanner } from "@/lib/consumer/bannerPattern";

type Params = Promise<{ token: string; id: string }>;

interface CampusBranding {
  name?: string;
  logo?: string;
  primaryColor?: string;
}

/** Map a news category to one of the four palette tokens. */
const CATEGORY_ACCENT: Record<NewsCategory, string> = {
  announcement: "var(--brand-primary-fill)",
  news: "var(--brand-accent-cool)",
  alert: "var(--brand-accent-warm)",
};

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
 * Layout mirrors the mobile-first mockup: striped cover area on
 * top (the post's image, when set, sits behind the brand-coloured
 * stripes), back chevron in a floating chip, then a content card
 * that lifts above the cover with `rounded-t-3xl`. Body content +
 * a primary Share button at the bottom.
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

  const lang = `?lang=${locale}`;
  const mapHref = `/campus/${token}/map${lang}`;
  const title = pickLocalized(post.title, post.titleEl, locale);
  const body = pickLocalized(post.body, post.bodyEl, locale);
  const accent =
    CATEGORY_ACCENT[post.category] ?? "var(--brand-primary-fill)";
  const shareUrl = `/campus/${token}/news/${id}${lang}`;

  return (
    <main id="main" data-consumer lang={locale}>
      <ConsumerNav
        campusName={campusName}
        logoUrl={branding.logo}
        token={token}
        locale={locale}
      />

      <article className="mx-auto max-w-[760px]">
        {/* Striped cover + image. `stripedBanner` paints the diagonal
            accent pattern; if a post image is set it sits behind the
            stripes via background-image, blended through the soft
            tint. Back chip floats top-left over both. */}
        <div
          className="relative h-56 w-full md:h-72"
          style={{
            ...stripedBanner(accent, 22),
            ...(post.imageUrl
              ? {
                  backgroundImage: `url(${post.imageUrl}), ${
                    (stripedBanner(accent, 22) as { backgroundImage: string })
                      .backgroundImage
                  }`,
                  backgroundSize: "cover, auto",
                  backgroundPosition: "center, top left",
                  backgroundBlendMode: "soft-light, normal",
                }
              : null),
          }}
        >
          <Link
            href={`/campus/${token}${lang}`}
            aria-label={`Back to ${campusName}`}
            className="absolute left-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-[var(--brand-text)] shadow-sm transition-colors hover:text-[var(--brand-primary)]"
          >
            <ChevronLeft size={18} strokeWidth={2} />
          </Link>
        </div>

        {/* Content card — lifted above the cover via negative margin,
            rounded-top. Article body + anchor chips + Share CTA. */}
        <div className="relative -mt-10 rounded-t-[2rem] bg-white px-5 pt-8 pb-10 shadow-[0_-12px_24px_-16px_rgba(0,0,0,0.08)] md:px-8 md:pt-10">
          <div className="flex items-center gap-3">
            <span
              className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-white"
              style={{ backgroundColor: accent }}
            >
              {post.category}
            </span>
            <span className="text-xs text-[var(--brand-text-muted)]">
              {formatNewsDate(post.publishedAt)}
            </span>
          </div>

          <h1 className="mt-4 text-3xl font-semibold leading-tight text-[var(--brand-text)] md:text-4xl">
            {title}
          </h1>

          <div className="mt-5 whitespace-pre-wrap text-base leading-relaxed text-[var(--brand-text)]">
            {body}
          </div>

          {post.anchors.length > 0 ? (
            <div className="mt-6 flex flex-wrap gap-2">
              {post.anchors.map((a, i) =>
                a.refId ? (
                  <Link
                    key={`${a.refId}-${i}`}
                    href={`${mapHref}&space=${encodeURIComponent(a.refId)}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-primary-bg)] px-3 py-1.5 text-xs font-medium text-[var(--brand-primary)] transition-opacity hover:opacity-80"
                  >
                    <MapPin size={14} strokeWidth={1.75} />
                    {a.refName}
                  </Link>
                ) : (
                  <span
                    key={`${a.refName}-${i}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-primary-bg)] px-3 py-1.5 text-xs font-medium text-[var(--brand-primary)]"
                  >
                    <MapPin size={14} strokeWidth={1.75} />
                    {a.refName}
                  </span>
                ),
              )}
            </div>
          ) : null}

          <div className="mt-8">
            <ShareButton
              title={title}
              url={shareUrl}
              text={body.slice(0, 180)}
            />
          </div>
        </div>
      </article>

      <ConsumerFooter campusName={campusName} />
    </main>
  );
}
