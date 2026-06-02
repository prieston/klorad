/**
 * Layout-level loading state for `/campus/[token]/*`.
 *
 * Next renders this in place of `{children}` while the next page
 * server-renders. The layout itself (top nav + bottom nav + theme
 * vars + skip link) stays mounted, so the visitor sees a continuous
 * shell with only the body swapping — same model as a native app
 * tab change.
 *
 * Generic on purpose. Per-route loading files can ship shape-
 * specific skeletons (segmented tabs + event cards for /events
 * etc.) on top of this one; until they do, this single file
 * covers every navigation gap.
 */
export default function CampusPublicLoading() {
  return (
    <section className="mx-auto w-full max-w-[1280px] px-4 py-8 md:px-6 md:py-12">
      <div className="h-7 w-40 animate-pulse rounded-md bg-[var(--brand-line)]" />
      <div className="mt-3 h-4 w-64 animate-pulse rounded-md bg-[var(--brand-line)]" />
      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-40 animate-pulse rounded-2xl bg-white"
          />
        ))}
      </div>
    </section>
  );
}
