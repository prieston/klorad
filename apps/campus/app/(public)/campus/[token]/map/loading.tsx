/**
 * Skeleton for the public map route. The real surface fills the
 * remaining viewport (`100dvh - 3.5rem` for the ConsumerNav), so we
 * mirror that bound exactly to avoid a layout shift the moment the
 * MappedIn viewer mounts.
 */
export default function MapLoading() {
  return (
    <main
      aria-hidden
      className="flex h-[calc(100dvh-3.5rem)] w-full flex-col bg-[var(--brand-page)]"
    >
      <div className="bg-[var(--brand-page)] px-4 pt-3 pb-3 md:px-6">
        <div className="h-11 w-full animate-pulse rounded-full bg-white shadow-sm" />
      </div>
      <div className="min-h-0 flex-1 md:px-6 md:pt-3">
        <div className="h-full w-full animate-pulse overflow-hidden bg-white md:rounded-2xl" />
      </div>
    </main>
  );
}
