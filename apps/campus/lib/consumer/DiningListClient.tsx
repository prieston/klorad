"use client";

import Link from "next/link";
import { Clock, ExternalLink, MapPin } from "lucide-react";
import { pickLocalized, type Locale } from "@/app/lib/i18n-core";
import type { DiningLocation } from "@/lib/dining-db";
import { useCampusDining } from "@/lib/swr/useCampusDining";
import { DiningListSkeleton } from "./DiningListSkeleton";

interface Props {
  token: string;
  locale: Locale;
  mapHref: string;
  initialLocations: DiningLocation[];
  emptyCopy: string;
}

/**
 * Client renderer for the dining grid. SWR keeps the list fresh
 * across navigations; SSR seeds the cache via `fallbackData`.
 */
export function DiningListClient({
  token,
  locale,
  mapHref,
  initialLocations,
  emptyCopy,
}: Props) {
  const { dining, isLoading } = useCampusDining(token, initialLocations);

  if (isLoading && dining.length === 0) {
    return <DiningListSkeleton rows={4} />;
  }

  if (dining.length === 0) {
    return (
      <div className="mt-10 rounded-2xl border border-[var(--brand-line)] bg-white p-8 text-center text-sm text-[var(--brand-text-muted)]">
        {emptyCopy}
      </div>
    );
  }

  return (
    <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
      {dining.map((l) => {
        const firstAnchor = l.anchors[0];
        const name = pickLocalized(l.name, l.nameEl, locale);
        const description = pickLocalized(
          l.description,
          l.descriptionEl,
          locale,
        );
        return (
          <article
            key={l.id}
            className="flex flex-col overflow-hidden rounded-2xl border border-[var(--brand-line)] bg-white"
          >
            {l.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={l.imageUrl}
                alt=""
                className="block aspect-[16/9] w-full object-cover"
              />
            ) : (
              <div
                aria-hidden
                className="aspect-[16/9] w-full"
                style={{
                  background:
                    "linear-gradient(135deg, var(--brand-primary-bg) 0%, var(--brand-primary-soft) 100%)",
                }}
              />
            )}
            <div className="flex flex-1 flex-col gap-3 p-5">
              <div>
                <h2 className="text-lg font-medium text-[var(--brand-text)]">
                  {name}
                </h2>
                {l.cuisine ? (
                  <p className="mt-0.5 text-xs uppercase tracking-wide text-[var(--brand-text-muted)]">
                    {l.cuisine}
                  </p>
                ) : null}
              </div>

              <p className="text-sm leading-relaxed text-[var(--brand-text)]">
                {description}
              </p>

              {l.hoursText ? (
                <p className="inline-flex items-center gap-1.5 text-xs text-[var(--brand-text-muted)]">
                  <Clock size={14} strokeWidth={1.75} />
                  {l.hoursText}
                </p>
              ) : null}

              <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
                {firstAnchor ? (
                  firstAnchor.refId ? (
                    <Link
                      href={`${mapHref}&space=${encodeURIComponent(firstAnchor.refId)}`}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-primary-bg)] px-3 py-1 text-xs font-medium text-[var(--brand-primary)] transition-opacity hover:opacity-80"
                    >
                      <MapPin size={14} strokeWidth={1.75} />
                      {firstAnchor.refName}
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-primary-bg)] px-3 py-1 text-xs font-medium text-[var(--brand-primary)]">
                      <MapPin size={14} strokeWidth={1.75} />
                      {firstAnchor.refName}
                    </span>
                  )
                ) : null}
                {l.menuUrl ? (
                  <a
                    href={l.menuUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-[var(--brand-line)] bg-white px-3 py-1 text-xs font-medium text-[var(--brand-text)] transition-colors hover:border-[var(--brand-primary)]"
                  >
                    <ExternalLink size={14} strokeWidth={1.75} />
                    View menu
                  </a>
                ) : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
