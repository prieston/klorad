"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Calendar, Compass, MapPin } from "lucide-react";
import { pickLocalized, type Locale } from "@/app/lib/i18n-core";
import {
  type EventPost,
  formatEventWhen,
} from "@/lib/events-db";
import type { CampusEvent } from "@/lib/events";
import { eventHasDetailPage, mergeEvents } from "@/lib/events-merge";
import type { ConsumerEvent } from "@/lib/consumer/types";
import { useCampusEvents } from "@/lib/swr/useCampusEvents";
import { stripedBanner } from "@/lib/consumer/bannerPattern";
import { EventsListSkeleton } from "./EventsListSkeleton";

const BANNER_BG: Record<string, string> = {
  purple: "var(--brand-primary-fill)",
  coral: "var(--brand-accent-warm)",
  teal: "var(--brand-accent-cool)",
  pink: "var(--brand-accent-complement)",
};

interface Props {
  token: string;
  locale: Locale;
  lang: string;
  mapHref: string;
  /** Server-rendered initial DB events — SWR seeds with this so
   *  the first paint never shows a skeleton. */
  initialDbEvents: EventPost[];
  /** ICS-feed events fetched server-side once per request; the
   *  client doesn't re-fetch them (they're slow + external). */
  icsEvents: CampusEvent[];
  /** Empty-state copy. */
  emptyCopy: string;
}

/**
 * Client renderer for the events list. SWR keeps the DB side of
 * the merge fresh across navigations; ICS events come in as a
 * static prop. The merged list is recomputed in a memo so a SWR
 * revalidation only swaps the affected rows. First paint shows
 * real content via `fallbackData`; the skeleton only renders on
 * a genuinely cold cache (rare since SSR seeds it).
 */
export function EventsListClient({
  token,
  locale,
  lang,
  mapHref,
  initialDbEvents,
  icsEvents,
  emptyCopy,
}: Props) {
  const { events: dbEvents, isLoading } = useCampusEvents(
    token,
    initialDbEvents,
  );

  const merged: ConsumerEvent[] = useMemo(() => {
    const localised = dbEvents.map((e) => ({
      ...e,
      title: pickLocalized(e.title, e.titleEl, locale),
      description: pickLocalized(e.description, e.descriptionEl, locale),
    }));
    return mergeEvents(localised, icsEvents, 100);
  }, [dbEvents, icsEvents, locale]);

  if (isLoading && merged.length === 0) {
    return <EventsListSkeleton rows={6} />;
  }

  if (merged.length === 0) {
    return (
      <div className="mt-10 rounded-2xl border border-[var(--brand-line)] bg-white p-8 text-center text-sm text-[var(--brand-text-muted)]">
        {emptyCopy}
      </div>
    );
  }

  return (
    <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
      {merged.map((e) => {
        const firstAnchor = e.anchors[0];
        const href = eventHasDetailPage(e.id)
          ? `/campus/${token}/events/${e.id}${lang}`
          : firstAnchor?.refId
            ? `${mapHref}&space=${encodeURIComponent(firstAnchor.refId)}`
            : mapHref;
        const accent =
          BANNER_BG[e.bannerColor] ?? "var(--brand-primary-fill)";
        return (
          <Link
            key={e.id}
            href={href}
            className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--brand-line)] bg-white transition-colors hover:border-[var(--brand-primary)]"
          >
            {e.imageUrl ? (
              <div className="relative aspect-[16/9] w-full overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={e.imageUrl}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                />
              </div>
            ) : (
              <div
                className="flex h-20 items-end justify-start p-4"
                style={stripedBanner(accent)}
              >
                <Calendar
                  size={24}
                  strokeWidth={1.5}
                  style={{ color: accent }}
                  aria-hidden
                />
              </div>
            )}
            <div className="flex flex-1 flex-col gap-2 p-5">
              <h2 className="text-base font-medium text-[var(--brand-text)]">
                {e.title}
              </h2>
              <span className="text-xs text-[var(--brand-text-muted)]">
                {formatEventWhen(e.startsAt)}
              </span>
              <p className="line-clamp-2 text-xs leading-relaxed text-[var(--brand-text-muted)]">
                {e.blurb}
              </p>
              <div className="mt-auto flex flex-wrap items-center gap-2 pt-2 text-xs text-[var(--brand-text-muted)]">
                {firstAnchor ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={14} strokeWidth={1.75} />
                    {firstAnchor.refName}
                  </span>
                ) : null}
                {firstAnchor?.refId ? (
                  <span className="ml-auto inline-flex items-center gap-1 text-[var(--brand-primary)] group-hover:underline">
                    <Compass size={14} strokeWidth={1.75} />
                    Directions
                  </span>
                ) : null}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
