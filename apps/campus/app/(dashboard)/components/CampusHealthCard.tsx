import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import type { CampusHealth } from "@/lib/campus-health";

interface Props {
  health: CampusHealth | null;
  isLoading?: boolean;
  /** Org id + campus id — drive the per-row deep-links so the
   *  rector can jump straight to the screen that closes a gap. */
  orgId: string;
  mapId: string;
}

/**
 * The 2-column checklist on the Campus Dashboard. Each row is one of
 * the 8 readiness checks from `readCampusHealth`. Top progress bar
 * makes the X/Y read at a glance — "5/8 done" beats "5 done".
 *
 * Incomplete rows render as `<Link>`s pointing at the screen that
 * fixes them, so a fresh rector can click "MappedIn venue" and land
 * on the right knob without hunting through the nav. Done rows
 * render as plain `<li>`s — clicking a finished check is rarely
 * useful. Title strings are neutral nouns; the green check (done)
 * or empty dot (not done) carries the state.
 *
 * Renders a skeleton on cold load so the layout doesn't pop.
 */
export function CampusHealthCard({
  health,
  isLoading,
  orgId,
  mapId,
}: Props) {
  if (isLoading && !health) {
    return (
      <section className="rounded-2xl border border-line-soft bg-surface-1 p-6">
        <div className="mb-4 h-4 w-32 animate-pulse rounded bg-surface-2" />
        <div className="mb-6 h-1.5 w-full animate-pulse rounded-full bg-surface-2" />
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl bg-surface-2"
            />
          ))}
        </div>
      </section>
    );
  }

  if (!health) return null;

  const pct = Math.round((health.passed / health.total) * 100);
  const base = `/org/${orgId}/maps/${mapId}`;

  return (
    <section className="rounded-2xl border border-line-soft bg-surface-1 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary">
          Campus health
        </h2>
        <span className="text-xs font-medium text-text-tertiary">
          {health.passed} / {health.total}
        </span>
      </div>
      <div
        className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <ul className="grid list-none gap-3 sm:grid-cols-2">
        {health.checks.map((c) => {
          const href = c.done ? null : hrefFor(c.key, base);
          const inner = (
            <>
              <span
                aria-hidden
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                  c.done
                    ? "bg-emerald-500 text-white"
                    : "border border-line-strong bg-surface-1 text-text-tertiary"
                }`}
              >
                {c.done ? (
                  <Check size={12} strokeWidth={3} />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-text-tertiary/40" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-text-primary">
                  {c.title}
                </div>
                <div className="mt-0.5 truncate text-xs text-text-tertiary">
                  {c.hint}
                </div>
              </div>
              {href ? (
                <ArrowRight
                  size={14}
                  strokeWidth={1.75}
                  aria-hidden
                  className="mt-1 shrink-0 text-text-tertiary"
                />
              ) : null}
            </>
          );

          if (href) {
            return (
              <li key={c.key}>
                <Link
                  href={href}
                  className="group flex items-start gap-3 rounded-xl border border-line-soft bg-surface-2/40 p-3 transition-colors hover:border-accent hover:bg-surface-2/70"
                >
                  {inner}
                </Link>
              </li>
            );
          }
          return (
            <li
              key={c.key}
              className="flex items-start gap-3 rounded-xl border border-line-soft bg-surface-2/40 p-3"
            >
              {inner}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Map each health key to the screen where the rector closes the
 *  gap. The mappings mirror the new Manage / Public-surface IA. */
function hrefFor(
  key: CampusHealth["checks"][number]["key"],
  base: string,
): string {
  switch (key) {
    case "branding":
      return `${base}/identity`;
    case "mappedin":
      return `${base}/map`;
    case "published":
      return `${base}/reach`;
    case "news":
      return `${base}/news`;
    case "events":
      return `${base}/events`;
    case "clubs":
      return `${base}/clubs`;
    case "dining":
      return `${base}/dining`;
    case "klio":
      return `${base}/klio`;
  }
}
