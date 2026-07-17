/**
 * Suspense fallback for the Paris tab — hero-plus-suggestions
 * skeleton that mirrors the real `AssistantPanel` hero so the tab
 * feels instant.
 */
export default function ParisLoading() {
  return (
    <main
      aria-hidden
      className="mx-auto flex max-w-[760px] flex-col items-center gap-4 px-4 pb-32 pt-16"
    >
      <div className="h-8 w-56 animate-pulse rounded-md bg-[var(--w-page,#eef1f6)]" />
      <div className="h-4 w-72 animate-pulse rounded-md bg-[var(--w-page,#eef1f6)]" />
      <div className="mt-6 flex w-full flex-wrap justify-center gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-8 w-36 animate-pulse rounded-full bg-[var(--w-page,#eef1f6)]"
          />
        ))}
      </div>
    </main>
  );
}
