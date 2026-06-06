/**
 * Skeleton for the Klio chat surface. The real screen is a
 * full-bleed chat column with an input chip pinned at the bottom;
 * the placeholder shells out that same shape so the chat input
 * doesn't pop in late.
 */
export default function KlioLoading() {
  return (
    <main
      aria-hidden
      className="flex h-[calc(100dvh-3.5rem)] w-full flex-col bg-[var(--brand-page)]"
    >
      <div className="mx-auto flex w-full max-w-[820px] flex-1 flex-col gap-4 px-4 py-8 md:px-6">
        <div className="h-8 w-40 animate-pulse rounded-md bg-[var(--brand-line)]" />
        <div className="h-4 w-64 animate-pulse rounded-md bg-[var(--brand-line)]" />
        <div className="mt-6 flex flex-1 flex-col gap-3">
          <div className="h-16 w-3/4 animate-pulse rounded-2xl bg-white" />
          <div className="ml-auto h-12 w-1/2 animate-pulse rounded-2xl bg-[color-mix(in_srgb,var(--brand-primary)_15%,#ffffff)]" />
          <div className="h-20 w-2/3 animate-pulse rounded-2xl bg-white" />
        </div>
        <div className="mt-4 h-12 w-full animate-pulse rounded-full bg-white shadow-sm" />
      </div>
    </main>
  );
}
