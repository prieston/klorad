/** Skeleton placeholder for the dining grid. */
export function DiningListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div
      aria-hidden
      className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex animate-pulse flex-col overflow-hidden rounded-2xl border border-[var(--brand-line)] bg-white"
        >
          <div className="aspect-[16/9] w-full bg-[color-mix(in_srgb,var(--brand-primary)_8%,#ffffff)]" />
          <div className="flex flex-1 flex-col gap-3 p-5">
            <div className="h-4 w-2/3 rounded bg-[var(--brand-line)]" />
            <div className="h-3 w-1/2 rounded bg-[var(--brand-line)]" />
            <div className="h-3 w-full rounded bg-[var(--brand-line)]" />
          </div>
        </div>
      ))}
    </div>
  );
}
