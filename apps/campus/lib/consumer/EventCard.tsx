import Link from "next/link";
import { Calendar, MapPin, Music, Sprout, Trophy } from "lucide-react";
import type { ConsumerEvent } from "./types";

const ICONS = {
  music: Music,
  trophy: Trophy,
  sprout: Sprout,
  calendar: Calendar,
} as const;

const BANNER_BG: Record<ConsumerEvent["bannerColor"], string> = {
  purple: "var(--brand-primary)",
  coral: "#D85A30",
  teal: "#1D9E75",
  pink: "#D4537E",
};

function formatWhen(startsAt: string): string {
  const d = new Date(startsAt);
  if (Number.isNaN(d.getTime())) return "";
  const day = d.toLocaleDateString(undefined, { weekday: "short" });
  const time = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: d.getMinutes() === 0 ? undefined : "2-digit",
  });
  return `${day} · ${time.toLowerCase()}`;
}

export interface EventCardProps {
  event: ConsumerEvent;
  /** Where the card links to — set up so detail page slot is ready when Arc 3 ships. */
  href: string;
}

/**
 * One card in the "Happening this week" grid. Colored banner with a
 * white outline icon at the top; title, date / time, anchor chip,
 * expected attendance under it. Whole card links to the event's
 * detail page (placeholder route for Arc 1).
 */
export function EventCard({ event, href }: EventCardProps) {
  const Icon = ICONS[event.bannerIcon];
  const where = event.anchors[0]?.refName;

  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--brand-line)] bg-white transition-colors hover:border-[var(--brand-primary)]"
    >
      <div
        className="flex h-24 items-end justify-start p-4"
        style={{ backgroundColor: BANNER_BG[event.bannerColor] }}
      >
        <Icon
          size={28}
          strokeWidth={1.5}
          className="text-white"
          aria-hidden
        />
      </div>
      <div className="flex flex-col gap-2 p-5">
        <h3 className="text-base font-medium text-[var(--brand-text)]">
          {event.title}
        </h3>
        <span className="text-xs text-[var(--brand-text-muted)]">
          {formatWhen(event.startsAt)}
        </span>
        <div className="mt-1 flex items-center gap-3 text-xs text-[var(--brand-text-muted)]">
          {where ? (
            <span className="inline-flex items-center gap-1">
              <MapPin size={14} strokeWidth={1.75} />
              {where}
            </span>
          ) : null}
          {event.expectedAttendance ? (
            <span>{event.expectedAttendance} going</span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
