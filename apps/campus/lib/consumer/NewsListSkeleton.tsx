/**
 * Skeleton placeholder for the news list. Mirrors the exact column
 * widths + row heights the real list uses so the page never reflows
 * when data lands. Visible only during a cold SWR fetch with no
 * `fallbackData` — the SSR'd surfaces seed the cache so the first
 * paint always shows real content.
 */
export function NewsListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div
      aria-hidden
      className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex animate-pulse flex-col overflow-hidden rounded-2xl border border-[var(--brand-line)] bg-white"
        >
          <div className="aspect-[16/9] w-full bg-[color-mix(in_srgb,var(--brand-primary)_6%,#ffffff)]" />
          <div className="flex flex-col gap-2 p-5">
            <div className="h-3 w-16 rounded bg-[var(--brand-line)]" />
            <div className="h-5 w-3/4 rounded bg-[var(--brand-line)]" />
            <div className="h-3 w-full rounded bg-[var(--brand-line)]" />
            <div className="h-3 w-5/6 rounded bg-[var(--brand-line)]" />
          </div>
        </div>
      ))}
    </div>
  );
}
