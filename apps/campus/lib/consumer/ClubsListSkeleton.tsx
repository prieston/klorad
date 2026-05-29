/** Skeleton placeholder for the clubs grid. Matches the real
 *  card's height + column widths so the layout never reflows. */
export function ClubsListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div
      aria-hidden
      className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex animate-pulse items-start gap-4 rounded-2xl border border-[var(--brand-line)] bg-white p-5"
        >
          <div className="h-12 w-12 shrink-0 rounded-2xl bg-[var(--brand-line)]" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-2/3 rounded bg-[var(--brand-line)]" />
            <div className="h-3 w-1/2 rounded bg-[var(--brand-line)]" />
            <div className="h-3 w-5/6 rounded bg-[var(--brand-line)]" />
          </div>
        </div>
      ))}
    </div>
  );
}
