/**
 * Suspense fallback for the Notifications tab — 6 placeholder rows
 * mirroring the real feed so bottom-nav taps paint instantly.
 */
export default function NotificationsLoading() {
  return (
    <main
      aria-hidden
      className="mx-auto flex max-w-[760px] flex-col gap-4 px-4 pb-32 pt-6 md:px-6"
    >
      <header>
        <div className="h-7 w-40 animate-pulse rounded-md bg-[var(--w-page,#eef1f6)]" />
        <div className="mt-2 h-4 w-64 animate-pulse rounded-md bg-[var(--w-page,#eef1f6)]" />
      </header>
      <ul className="divide-y divide-[var(--w-border,#e6e6ea)] rounded-2xl border border-[var(--w-border,#e6e6ea)] bg-[var(--w-surface,#ffffff)]">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="flex items-start gap-3 px-4 py-3">
            <div className="mt-0.5 h-8 w-8 shrink-0 animate-pulse rounded-full bg-[var(--w-page,#eef1f6)]" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/5 animate-pulse rounded-md bg-[var(--w-page,#eef1f6)]" />
              <div className="h-3 w-full animate-pulse rounded-md bg-[var(--w-page,#eef1f6)]" />
              <div className="flex gap-1">
                <div className="h-4 w-20 animate-pulse rounded-full bg-[var(--w-page,#eef1f6)]" />
                <div className="h-4 w-24 animate-pulse rounded-full bg-[var(--w-page,#eef1f6)]" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
