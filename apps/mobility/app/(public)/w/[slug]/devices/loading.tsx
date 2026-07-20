/**
 * Suspense fallback for the Devices tab — 8 placeholder rows plus
 * search + filter chip skeletons. Same layout as `DevicesList` so
 * there's no shift when the real list swaps in.
 */
export default function DevicesLoading() {
  return (
    <main
      aria-hidden
      className="mx-auto flex max-w-[760px] flex-col gap-4 px-4 pb-32 pt-6 md:px-6"
    >
      <header>
        <div className="h-7 w-32 animate-pulse rounded-md bg-[var(--w-page,#eef1f6)]" />
        <div className="mt-2 h-4 w-64 animate-pulse rounded-md bg-[var(--w-page,#eef1f6)]" />
      </header>

      <div className="h-10 animate-pulse rounded-full bg-[var(--w-page,#eef1f6)]" />

      <div className="flex gap-1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-7 w-16 animate-pulse rounded-full bg-[var(--w-page,#eef1f6)]"
          />
        ))}
      </div>

      <ul className="divide-y divide-[var(--w-border,#e6e6ea)] rounded-2xl border border-[var(--w-border,#e6e6ea)] bg-[var(--w-surface,#ffffff)]">
        {Array.from({ length: 8 }).map((_, i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-[var(--w-page,#eef1f6)]" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-40 animate-pulse rounded-md bg-[var(--w-page,#eef1f6)]" />
              <div className="h-3 w-28 animate-pulse rounded-md bg-[var(--w-page,#eef1f6)]" />
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
