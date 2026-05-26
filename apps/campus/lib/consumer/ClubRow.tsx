import type { ConsumerClub } from "./types";

const AVATAR_BG: Record<ConsumerClub["avatarColor"], string> = {
  purple: "var(--brand-primary)",
  coral: "#D85A30",
  teal: "#1D9E75",
  pink: "#D4537E",
};

export interface ClubRowProps {
  club: ConsumerClub;
}

/**
 * One row in the "Most active clubs" rail. Coloured square avatar
 * with initials + name + member count + meets cadence on the left;
 * "View" pill on the right opens the club's external link in a new
 * tab. No identity / login involved — see [[campus-consumer-pivot]].
 */
export function ClubRow({ club }: ClubRowProps) {
  return (
    <div className="flex items-center gap-4 border-b border-[var(--brand-line)] py-3 last:border-b-0">
      <span
        aria-hidden
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-medium text-white"
        style={{ backgroundColor: AVATAR_BG[club.avatarColor] }}
      >
        {club.initials}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-[var(--brand-text)]">
          {club.name}
        </div>
        <div className="mt-0.5 text-xs text-[var(--brand-text-muted)]">
          {club.memberCount} members · {club.meetsCadence}
        </div>
      </div>
      <a
        href={club.externalLink}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 rounded-full px-4 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: "var(--brand-primary)" }}
      >
        View
      </a>
    </div>
  );
}
