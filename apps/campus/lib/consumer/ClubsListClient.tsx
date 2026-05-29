"use client";

import Link from "next/link";
import { ExternalLink, MapPin } from "lucide-react";
import { pickLocalized, type Locale } from "@/app/lib/i18n-core";
import type { Club } from "@/lib/clubs-db";
import { useCampusClubs } from "@/lib/swr/useCampusClubs";
import { ClubsListSkeleton } from "./ClubsListSkeleton";

const AVATAR_BG: Record<string, string> = {
  purple: "var(--brand-primary-fill)",
  coral: "var(--brand-accent-warm)",
  teal: "var(--brand-accent-cool)",
  pink: "var(--brand-accent-complement)",
};

interface Props {
  token: string;
  locale: Locale;
  lang: string;
  initialClubs: Club[];
  emptyCopy: string;
}

/**
 * Client renderer for the clubs grid. SWR keeps the list fresh on
 * focus / reconnect / cache miss; SSR seeds the cache via
 * `fallbackData` so the first paint is real content. The skeleton
 * shows only when the cache is genuinely cold.
 */
export function ClubsListClient({
  token,
  locale,
  lang,
  initialClubs,
  emptyCopy,
}: Props) {
  const { clubs, isLoading } = useCampusClubs(token, initialClubs);

  if (isLoading && clubs.length === 0) {
    return <ClubsListSkeleton rows={6} />;
  }

  if (clubs.length === 0) {
    return (
      <div className="mt-10 rounded-2xl border border-[var(--brand-line)] bg-white p-8 text-center text-sm text-[var(--brand-text-muted)]">
        {emptyCopy}
      </div>
    );
  }

  return (
    <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
      {clubs.map((c) => {
        const name = pickLocalized(c.name, c.nameEl, locale);
        const description = pickLocalized(
          c.description,
          c.descriptionEl,
          locale,
        );
        return (
          <article
            key={c.id}
            className="flex flex-col gap-3 rounded-2xl border border-[var(--brand-line)] bg-white p-5"
          >
            <div className="flex items-center gap-3">
              {c.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.imageUrl}
                  alt=""
                  className="h-12 w-12 rounded-xl object-cover"
                />
              ) : (
                <span
                  aria-hidden
                  className="flex h-12 w-12 items-center justify-center rounded-xl text-sm font-medium text-white"
                  style={{ backgroundColor: AVATAR_BG[c.avatarColor] }}
                >
                  {c.initials}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <Link
                  href={`/campus/${token}/clubs/${c.id}${lang}`}
                  className="block truncate text-base font-medium text-[var(--brand-text)] transition-colors hover:text-[var(--brand-primary)]"
                >
                  {name}
                </Link>
                <p className="mt-0.5 truncate text-xs text-[var(--brand-text-muted)]">
                  {c.memberCount} members
                  {c.meetsCadence ? ` · ${c.meetsCadence}` : ""}
                </p>
              </div>
            </div>

            <p className="line-clamp-3 text-sm leading-relaxed text-[var(--brand-text)]">
              {description}
            </p>

            {c.anchors[0] ? (
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[var(--brand-primary-bg)] px-3 py-1 text-xs font-medium text-[var(--brand-primary)]">
                <MapPin size={12} strokeWidth={1.75} />
                {c.anchors[0].refName}
              </span>
            ) : null}

            <div className="mt-auto flex items-center gap-2 pt-2">
              <Link
                href={`/campus/${token}/clubs/${c.id}${lang}`}
                className="rounded-full border border-[var(--brand-line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--brand-text)] transition-colors hover:border-[var(--brand-primary)]"
              >
                Details
              </Link>
              {c.externalLink ? (
                <a
                  href={c.externalLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "var(--brand-primary)" }}
                >
                  <ExternalLink size={12} strokeWidth={1.75} />
                  View
                </a>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
