/** Skeleton placeholder for the events grid — same column widths
 *  and card heights as `EventCard` so the layout doesn't reflow
 *  when data lands. */
export function EventsListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div
      aria-hidden
      className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex animate-pulse flex-col overflow-hidden rounded-2xl border border-[var(--brand-line)] bg-white"
        >
          <div className="h-20 w-full bg-[color-mix(in_srgb,var(--brand-primary)_8%,#ffffff)]" />
          <div className="flex flex-1 flex-col gap-2 p-5">
            <div className="h-4 w-3/4 rounded bg-[var(--brand-line)]" />
            <div className="h-3 w-1/2 rounded bg-[var(--brand-line)]" />
            <div className="h-3 w-full rounded bg-[var(--brand-line)]" />
            <div className="h-3 w-5/6 rounded bg-[var(--brand-line)]" />
          </div>
        </div>
      ))}
    </div>
  );
}
