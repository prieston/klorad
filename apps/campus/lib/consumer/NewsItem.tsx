import Link from "next/link";
import type { ConsumerNews } from "./types";

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const day = 1000 * 60 * 60 * 24;
  const days = Math.floor(diffMs / day);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "a week ago";
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return new Date(iso).toLocaleDateString();
}

export interface NewsItemProps {
  item: ConsumerNews;
  /** Where the headline links to (detail page slot for Arc 2). */
  href: string;
}

/**
 * One row in the "Campus news" rail. Headline + short excerpt +
 * "X days ago" timestamp. Headline is the clickable target — the
 * detail page lands in Arc 2.
 */
export function NewsItem({ item, href }: NewsItemProps) {
  return (
    <article className="border-b border-[var(--brand-line)] py-4 last:border-b-0">
      <Link href={href} className="block group">
        <h3 className="text-sm font-medium text-[var(--brand-text)] transition-colors group-hover:text-[var(--brand-primary)]">
          {item.title}
        </h3>
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--brand-text-muted)]">
          {item.excerpt}
        </p>
        <div className="mt-2 text-[0.7rem] uppercase tracking-wide text-[var(--brand-text-muted)]">
          {relativeTime(item.publishedAt)}
        </div>
      </Link>
    </article>
  );
}
