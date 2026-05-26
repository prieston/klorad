import Link from "next/link";
import type { ConsumerClub } from "./types";

const AVATAR_BG: Record<ConsumerClub["avatarColor"], string> = {
  purple: "var(--brand-primary)",
  coral: "#D85A30",
  teal: "#1D9E75",
  pink: "#D4537E",
};

export interface ClubRowProps {
  club: ConsumerClub;
  /**
   * Optional detail-page URL. When set, the row's avatar + name area
   * link to the in-app club detail; the View pill keeps opening the
   * external link in a new tab. Without a detailHref, the name is
   * static and only the View pill is interactive (Arc-1 behaviour).
   */
  detailHref?: string;
}

/**
 * One row in the "Most active clubs" rail. Coloured square avatar
 * with initials + name + member count + meets cadence on the left;
 * "View" pill on the right opens the club's external link in a new
 * tab. No identity / login involved — see [[campus-consumer-pivot]].
 *
 * When `detailHref` is set, the body links to the in-app detail
 * page (Arc 4 onwards) while the View pill keeps pointing at the
 * external link. When `externalLink` is empty, the pill is hidden.
 */
export function ClubRow({ club, detailHref }: ClubRowProps) {
  const bodyClass =
    "flex min-w-0 flex-1 items-center gap-4 transition-opacity hover:opacity-80";

  const body = (
    <>
      <span
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-medium text-white"
        style={{ backgroundColor: AVATAR_BG[club.avatarColor] }}
      >
        {club.initials}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-[var(--brand-text)]">
          {club.name}
        </span>
        <span className="mt-0.5 block text-xs text-[var(--brand-text-muted)]">
          {club.memberCount} members
          {club.meetsCadence ? ` · ${club.meetsCadence}` : ""}
        </span>
      </span>
    </>
  );

  return (
    <div className="flex items-center gap-3 border-b border-[var(--brand-line)] py-3 last:border-b-0">
      {detailHref ? (
        <Link href={detailHref} className={bodyClass}>
          {body}
        </Link>
      ) : (
        <div className={bodyClass}>{body}</div>
      )}
      {club.externalLink ? (
        <a
          href={club.externalLink}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-full px-4 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--brand-primary)" }}
        >
          View
        </a>
      ) : null}
    </div>
  );
}
