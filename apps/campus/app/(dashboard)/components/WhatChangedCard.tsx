import Link from "next/link";
import {
  ArrowRight,
  Bell,
  Calendar,
  History,
  Megaphone,
  Newspaper,
  Palette,
  Shield,
  Users,
  Utensils,
} from "lucide-react";
import type { CampusChange, ChangeKind } from "@/lib/changes";

interface Props {
  items: CampusChange[];
  isLoading?: boolean;
}

/**
 * "What Changed" feed on the campus dashboard. Renders the merged
 * activity list synthesised by `lib/changes.ts` — a row per recent
 * change with an icon, a label, a relative timestamp, and a
 * deep-link to the screen that owns the entity.
 *
 * Three states:
 *   - cold (no data yet) → skeleton rows so the layout doesn't pop
 *   - empty (fresh campus, no edits) → friendly placeholder
 *   - populated → list
 *
 * Kept presentational — the parent owns SWR, this just renders. That
 * way the same component can render server-supplied data on the org
 * dashboard later without a new variant.
 */
export function WhatChangedCard({ items, isLoading }: Props) {
  return (
    <section className="rounded-2xl border border-line-soft bg-surface-1 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary">
          What changed
        </h2>
        <span className="text-xs text-text-tertiary">last 30 days</span>
      </div>

      {isLoading && items.length === 0 ? (
        <ul className="space-y-3">
          {[0, 1, 2].map((i) => (
            <li
              key={i}
              className="h-12 animate-pulse rounded-xl bg-surface-2/60"
            />
          ))}
        </ul>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
          <div
            aria-hidden
            className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent"
          >
            <History size={18} strokeWidth={1.6} />
          </div>
          <p className="text-sm font-medium text-text-primary">
            No activity yet
          </p>
          <p className="max-w-xs text-xs text-text-tertiary">
            Edits to this campus appear here so the team can see what
            changed and when.
          </p>
        </div>
      ) : (
        <ul className="list-none space-y-1.5">
          {items.map((item) => (
            <ChangeRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ChangeRow({ item }: { item: CampusChange }) {
  const Icon = ICONS[item.kind];
  const verb = verbFor(item);
  const inner = (
    <>
      <span
        aria-hidden
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent"
      >
        <Icon size={14} strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-medium text-text-tertiary">
            {verb}
          </span>
          <span className="truncate text-sm font-medium text-text-primary">
            {item.title}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-text-tertiary">
          <time dateTime={item.at}>{relative(item.at)}</time>
          {item.actor ? (
            <>
              <span aria-hidden>·</span>
              <span>by {item.actor}</span>
            </>
          ) : null}
          {item.detail ? (
            <>
              <span aria-hidden>·</span>
              <span>{item.detail}</span>
            </>
          ) : null}
        </div>
      </div>
      {item.href ? (
        <ArrowRight
          size={14}
          strokeWidth={1.75}
          aria-hidden
          className="shrink-0 text-text-tertiary"
        />
      ) : null}
    </>
  );

  if (item.href) {
    return (
      <li>
        <Link
          href={item.href}
          className="group flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-2/60"
        >
          {inner}
        </Link>
      </li>
    );
  }
  return (
    <li className="flex items-center gap-3 px-2 py-2">{inner}</li>
  );
}

const ICONS: Record<ChangeKind, typeof Newspaper> = {
  news: Newspaper,
  event: Calendar,
  club: Users,
  dining: Utensils,
  campus: Palette,
  broadcast: Megaphone,
  member: Shield,
  subscribers: Bell,
};

/** Verb phrase used as the row's eyebrow. Kept short — the entity's
 *  own title carries the specifics. Audit-derived rows often pre-
 *  render the verb inside `title` already (e.g. "Published Foo"), so
 *  this is the eyebrow that contextualises the entity bucket. */
function verbFor(item: CampusChange): string {
  if (item.kind === "subscribers") return "Subscribers";
  if (item.kind === "campus") return item.isNew ? "Created" : "Updated";
  if (item.kind === "broadcast") return "Broadcast";
  if (item.kind === "member") return "Members";
  const verb = item.isNew ? "New" : "Updated";
  const noun = {
    news: "news",
    event: "event",
    club: "club",
    dining: "dining",
    campus: "",
    broadcast: "",
    member: "",
    subscribers: "",
  }[item.kind];
  return `${verb} ${noun}`;
}

const RELATIVE_THRESHOLDS = [
  { ms: 60_000, label: "just now" },
  { ms: 60 * 60_000, divisor: 60_000, suffix: "m" },
  { ms: 24 * 60 * 60_000, divisor: 60 * 60_000, suffix: "h" },
  { ms: 7 * 24 * 60 * 60_000, divisor: 24 * 60 * 60_000, suffix: "d" },
  { ms: 30 * 24 * 60 * 60_000, divisor: 7 * 24 * 60 * 60_000, suffix: "w" },
] as const;

/** Compact relative time, e.g. `"3h"`, `"2d"`. Falls back to a
 *  short locale date for anything older than a month. */
function relative(iso: string): string {
  const ageMs = Date.now() - new Date(iso).getTime();
  if (ageMs < 0) return "just now";
  for (const t of RELATIVE_THRESHOLDS) {
    if (ageMs < t.ms) {
      if ("label" in t) return t.label;
      const n = Math.max(1, Math.floor(ageMs / t.divisor));
      return `${n}${t.suffix}`;
    }
  }
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
