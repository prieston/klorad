import { Check, X } from "lucide-react";
import { Panel } from "@klorad/design-system";

export interface CampusHealthProps {
  brandComplete: boolean;
  hasIndoorMap: boolean;
  isPublished: boolean;
  newsCount: number;
  eventsCount: number;
  clubsCount: number;
  diningCount: number;
  feedCount: number;
  /** `process.env.ANTHROPIC_API_KEY` truthy at request time. */
  assistantEnabled: boolean;
}

interface Check {
  label: string;
  /** Optional helper line under the label. */
  hint?: string;
  ok: boolean;
  /** When `false`, the check is informational (greyed out) rather than red. */
  required?: boolean;
}

/**
 * Bottom-of-page "Campus health" panel — one ✓/✗ per dimension the
 * tenant is likely to forget. Mostly informational; the counts come
 * from the same Prisma reads the public surface uses, plus the
 * `ANTHROPIC_API_KEY` env var (server-only). The numbers in the
 * thresholds are intentionally low — we want a *healthy* tenant to
 * easily hit them, not a *complete* one.
 */
export function CampusHealth({
  brandComplete,
  hasIndoorMap,
  isPublished,
  newsCount,
  eventsCount,
  clubsCount,
  diningCount,
  feedCount,
  assistantEnabled,
}: CampusHealthProps) {
  const checks: Check[] = [
    {
      label: "Branding is complete",
      hint: "Name, logo, and primary colour all set",
      ok: brandComplete,
      required: true,
    },
    {
      label: "MappedIn venue is connected",
      hint: "Without it, anchors can't deep-link into the map",
      ok: hasIndoorMap,
      required: true,
    },
    {
      label: "Campus is published",
      hint: "Drafts aren't visible to students",
      ok: isPublished,
      required: true,
    },
    {
      label: "At least 1 news post",
      ok: newsCount >= 1,
    },
    {
      label: "At least 3 events scheduled",
      hint: `Currently ${eventsCount}`,
      ok: eventsCount >= 3,
    },
    {
      label: "At least 1 club published",
      ok: clubsCount >= 1,
    },
    {
      label: "At least 1 dining location",
      ok: diningCount >= 1,
    },
    {
      label: "ICS feed connected",
      hint: "Optional — but auto-syncing calendars beats manual entry",
      ok: feedCount >= 1,
      required: false,
    },
    {
      label: "AI chat enabled",
      hint: assistantEnabled
        ? "ANTHROPIC_API_KEY is set"
        : "Set ANTHROPIC_API_KEY to power natural-language search",
      ok: assistantEnabled,
      required: false,
    },
  ];

  const passing = checks.filter((c) => c.ok).length;
  const total = checks.length;
  const ratio = total > 0 ? passing / total : 0;

  return (
    <Panel className="mt-8 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-text-primary">
          Campus health
        </h2>
        <span className="text-xs font-medium text-text-tertiary">
          {passing} / {total}
        </span>
      </div>

      <div
        aria-hidden
        className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
      >
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>

      <ul className="mt-5 grid grid-cols-1 gap-2 md:grid-cols-2">
        {checks.map((c) => (
          <li
            key={c.label}
            className="flex items-start gap-3 rounded-lg border border-solid border-line-soft p-3"
          >
            <span
              aria-hidden
              className={
                c.ok
                  ? "flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"
                  : c.required === false
                    ? "flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-tertiary"
                    : "flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600"
              }
            >
              {c.ok ? (
                <Check size={12} strokeWidth={2.5} />
              ) : (
                <X size={12} strokeWidth={2.5} />
              )}
            </span>
            <div className="min-w-0">
              <span className="block text-sm font-medium text-text-primary">
                {c.label}
              </span>
              {c.hint ? (
                <span className="mt-0.5 block text-xs text-text-tertiary">
                  {c.hint}
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
