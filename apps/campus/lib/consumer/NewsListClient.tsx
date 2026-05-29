"use client";

import Link from "next/link";
import { MapPin } from "lucide-react";
import { pickLocalized, type Locale } from "@/app/lib/i18n-core";
import { relativeNewsTime, type NewsPost } from "@/lib/news";
import { useCampusNews } from "@/lib/swr/useCampusNews";
import { NewsListSkeleton } from "./NewsListSkeleton";

interface LegacyDisplay {
  id: string;
  title: string;
  body: string;
  publishedAt: string;
  anchors: Array<{ kind: "room" | "building"; refId: string; refName: string }>;
  detailHref: string;
}

interface Props {
  token: string;
  locale: Locale;
  /** Build link target for `?lang=…`. */
  lang: string;
  /** Server-rendered initial DB news so the first paint never
   *  shows a skeleton — SWR seeds its cache with this. */
  initialNews: NewsPost[];
  /** Legacy `sceneData.posts` already shaped for display. Merged
   *  with the (SWR-managed) DB news on every render. */
  legacy: LegacyDisplay[];
  /** Empty-state copy. */
  emptyCopy: string;
}

/**
 * Client renderer for the news list — uses SWR to keep the DB
 * news fresh across navigations, merges with the legacy
 * `sceneData.posts` shape, sorts newest-first. The first paint
 * always uses `initialNews` as fallback so visitors never see a
 * skeleton on the SSR'd path; subsequent in-session re-mounts
 * pop instantly from SWR's cache and revalidate in the background.
 */
export function NewsListClient({
  token,
  locale,
  lang,
  initialNews,
  legacy,
  emptyCopy,
}: Props) {
  const { news: dbNews, isLoading } = useCampusNews(token, initialNews);

  const merged = [
    ...dbNews.map((p) => ({
      id: p.id,
      title: pickLocalized(p.title, p.titleEl, locale),
      body: pickLocalized(p.body, p.bodyEl, locale),
      publishedAt: p.publishedAt,
      anchors: p.anchors.map((a) => ({
        kind: a.kind,
        refId: a.refId,
        refName: a.refName,
      })),
      detailHref: `/campus/${token}/news/${p.id}${lang}`,
    })),
    ...legacy,
  ].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));

  // Skeleton only shows when SWR has no cached data AND no
  // fallback — i.e., the SSR path didn't provide initial data
  // (rare) OR the visitor lands here from a soft-nav without
  // having visited before.
  if (isLoading && merged.length === 0) {
    return <NewsListSkeleton rows={4} />;
  }

  if (merged.length === 0) {
    return (
      <div className="mt-10 rounded-2xl border border-[var(--brand-line)] bg-white p-8 text-center text-sm text-[var(--brand-text-muted)]">
        {emptyCopy}
      </div>
    );
  }

  return (
    <div className="mt-6">
      {merged.map((n) => (
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
  );
}
