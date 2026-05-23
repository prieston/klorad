"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { type CampusEvent, formatEventWhen } from "@/lib/events";
import { type Locale, translate } from "@/app/lib/i18n-core";
import { venueForIndoorMap } from "@/lib/mappedin/config";
import { loadMappedinSpaces } from "@/lib/mappedin/spaces";

interface Props {
  events: CampusEvent[];
  /** The campus's MappedIn venue id, when it has one. */
  indoorMapId?: string;
  token: string;
  locale: Locale;
  accent: string;
}

const normalize = (s: string) => s.trim().toLowerCase();

/**
 * The public home's events section.
 *
 * Events come from the campus's ICS feeds with a free-text
 * `location`. When the campus is on MappedIn, that location is
 * matched against the venue's space names — a hit turns the location
 * into a link straight into the indoor map, focused on that room.
 * The match runs client-side (the MappedIn SDK is browser-only); the
 * events themselves still server-render for SEO.
 */
export function CampusEvents({
  events,
  indoorMapId,
  token,
  locale,
  accent,
}: Props) {
  const [spaces, setSpaces] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!indoorMapId) return;
    let cancelled = false;
    void loadMappedinSpaces(venueForIndoorMap(indoorMapId))
      .then((sp) => {
        if (!cancelled) {
          setSpaces(sp.map((s) => ({ id: s.id, name: s.name })));
        }
      })
      .catch(() => {
        /* no room links if the venue can't be read */
      });
    return () => {
      cancelled = true;
    };
  }, [indoorMapId]);

  /** Match an event's free-text location to a MappedIn space id. */
  const spaceFor = (location: string | undefined): string | null => {
    if (!location || spaces.length === 0) return null;
    const loc = normalize(location);
    const exact = spaces.find((s) => normalize(s.name) === loc);
    if (exact) return exact.id;
    const partial = spaces.find((s) => {
      const name = normalize(s.name);
      return name.length > 2 && (loc.includes(name) || name.includes(loc));
    });
    return partial?.id ?? null;
  };

  if (events.length === 0) return null;

  return (
    <section className="px-6 pb-4 md:px-10">
      <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-text-tertiary">
        {translate(locale, "home.events")}
      </h2>
      <div className="mt-4 space-y-3">
        {events.map((event) => {
          const spaceId = spaceFor(event.location);
          return (
            <article
              key={event.id}
              className="flex items-baseline gap-4 rounded-2xl bg-surface-1 px-5 py-4 shadow-glass"
            >
              <time
                className="shrink-0 text-xs font-medium"
                style={{ color: accent }}
              >
                {formatEventWhen(event.start, event.allDay)}
              </time>
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-text-primary">
                  {event.title}
                </h3>
                {event.location ? (
                  spaceId ? (
                    <Link
                      href={`/campus/${token}/map?lang=${locale}&space=${encodeURIComponent(spaceId)}`}
                      className="block truncate text-xs font-medium text-accent transition-opacity hover:opacity-80"
                    >
                      {event.location} →
                    </Link>
                  ) : (
                    <p className="truncate text-xs text-text-tertiary">
                      {event.location}
                    </p>
                  )
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
