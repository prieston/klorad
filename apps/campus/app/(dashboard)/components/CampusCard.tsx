"use client";

import Link from "next/link";
import { MapPin } from "lucide-react";
import { bannerGradient, bannerOverlay } from "./campusBanner";

interface Stat {
  label: string;
  value: string;
}

interface Props {
  id: string;
  name: string;
  /** Optional location label rendered under the name ("Thessaloniki"). */
  location?: string;
  /** Optional kind label rendered as a pill inside the banner ("Headquarters" / "Campus"). */
  kind?: string;
  isPublished?: boolean;
  /** Up to three small stat boxes shown in the card body. */
  stats?: Stat[];
  /** ISO/Date string — rendered as "Updated …" footer. Optional. */
  updatedAt?: string | number | Date;
  href: string;
  /** Compact mode shrinks the banner height — used in dense grids. */
  compact?: boolean;
  /** Optional card image. When set, replaces the gradient banner with
   *  the rector's uploaded campus hero. Falls back to the gradient
   *  when null / undefined so an unbranded campus still has a
   *  coloured banner. */
  thumbnail?: string | null;
}

/**
 * The campus card shipped across the Org Overview's "Most active" rail
 * and the Org Campuses grid. Gradient banner + name + optional pill +
 * stats + updated stamp. Hue is derived from the campus id so it stays
 * stable across screens — see `campusBanner.ts`.
 */
export function CampusCard({
  id,
  name,
  location,
  kind,
  isPublished,
  stats,
  updatedAt,
  href,
  compact = false,
  thumbnail,
}: Props) {
  const updated = updatedAt
    ? new Date(updatedAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;
  const bannerHeight = compact ? "h-20" : "h-28";

  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line-soft bg-surface-1 transition-colors hover:border-line-strong"
    >
      <div
        className={`${bannerHeight} relative flex items-end justify-between p-3`}
        style={
          thumbnail
            ? {
                backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.45) 100%), url("${thumbnail}")`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : {
                background: bannerGradient(id),
                backgroundImage: `${bannerOverlay()}, ${bannerGradient(id)}`,
                backgroundSize: "12px 12px, auto",
              }
        }
        aria-hidden
      >
        {kind ? (
          <span className="inline-flex items-center rounded-md bg-black/40 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white backdrop-blur-sm">
            {kind}
          </span>
        ) : (
          <span />
        )}
        {thumbnail ? null : (
          <MapPin
            size={18}
            strokeWidth={1.75}
            className="text-white/90 drop-shadow-sm"
          />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-text-primary">
              {name}
            </div>
            {location ? (
              <div className="mt-0.5 flex items-center gap-1 text-xs text-text-tertiary">
                <MapPin size={11} strokeWidth={1.75} aria-hidden />
                {location}
              </div>
            ) : null}
          </div>
          {isPublished !== undefined ? (
            <span
              className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                isPublished
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "bg-text-tertiary/10 text-text-tertiary"
              }`}
            >
              <span
                aria-hidden
                className={`h-1.5 w-1.5 rounded-full ${
                  isPublished ? "bg-emerald-500" : "bg-text-tertiary"
                }`}
              />
              {isPublished ? "Published" : "Draft"}
            </span>
          ) : null}
        </div>
        {stats && stats.length > 0 ? (
          <div className="grid grid-cols-3 gap-3 text-xs">
            {stats.map((s) => (
              <div key={s.label}>
                <div className="text-base font-medium text-text-primary">
                  {s.value}
                </div>
                <div className="text-[10px] uppercase tracking-wide text-text-tertiary">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        ) : null}
        <div className="mt-auto flex items-center justify-between border-t border-line-soft pt-3 text-xs">
          <span className="text-text-tertiary">
            {updated ? `Updated ${updated}` : ""}
          </span>
          <span className="font-medium text-accent group-hover:underline">
            Open →
          </span>
        </div>
      </div>
    </Link>
  );
}
