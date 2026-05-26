import Link from "next/link";

const FILTER_PILLS: { label: string; active?: boolean }[] = [
  { label: "Study spots", active: true },
  { label: "Food" },
  { label: "Fitness" },
  { label: "Events" },
];

export interface MapTeaserProps {
  /** URL of the real MappedIn viewer for this campus. */
  mapHref: string;
  /**
   * MappedIn-captured thumbnail for the venue. Set in the dashboard
   * via "Capture thumbnail." When present, used in place of the
   * fallback illustration so the teaser reflects the real campus.
   */
  thumbnailUrl?: string;
}

/**
 * Right-column card on the hero — a "Campus map" panel with a
 * live indicator dot, the real MappedIn-captured thumbnail of the
 * venue (when set), and four filter pills underneath. Tap anywhere
 * → drops the visitor into the real MappedIn viewer at `mapHref`.
 *
 * When no thumbnail is set, falls back to a small generic gradient
 * placeholder rather than a cartoon SVG of fake buildings — better
 * to look unfinished than to show buildings the campus doesn't have.
 */
export function MapTeaser({ mapHref, thumbnailUrl }: MapTeaserProps) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-[var(--brand-line)] bg-white p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full bg-[#1D9E75]"
          />
          <span className="text-sm font-medium text-[var(--brand-text)]">
            Campus map
          </span>
        </div>
        <Link
          href={mapHref}
          className="text-xs font-medium text-[var(--brand-text-muted)] transition-colors hover:text-[var(--brand-primary)]"
        >
          Open ↗
        </Link>
      </div>

      <Link
        href={mapHref}
        aria-label="Open campus map"
        className="mt-4 block aspect-[4/3] overflow-hidden rounded-xl"
        style={
          thumbnailUrl
            ? undefined
            : {
                background:
                  "linear-gradient(135deg, var(--brand-primary-bg) 0%, #E0F2EE 100%)",
              }
        }
      >
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl}
            alt="Campus map preview"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-sm text-[var(--brand-text-muted)]">
            Map coming soon
          </span>
        )}
      </Link>

      <div className="mt-4 flex flex-wrap gap-2">
        {FILTER_PILLS.map((p) => (
          <span
            key={p.label}
            className={
              p.active
                ? "rounded-full px-3 py-1 text-xs font-medium text-white"
                : "rounded-full border border-[var(--brand-line)] bg-white px-3 py-1 text-xs font-medium text-[var(--brand-text-muted)]"
            }
            style={
              p.active ? { backgroundColor: "var(--brand-primary)" } : undefined
            }
          >
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}
