/**
 * Suspense fallback for the Map tab. Rendered instantly while the
 * server component resolves the world's device list + palette, so
 * tapping "Map" in the bottom nav from another tab shows the
 * skeleton frame right away rather than a delay + jump.
 *
 * Height matches the real `<main>` (`100dvh - 3.5rem` for the top
 * nav) so the bottom-nav overlap zone stays stable and there's no
 * layout shift when the map paints.
 */
export default function MapTabLoading() {
  return (
    <main
      aria-hidden
      className="relative w-full overflow-hidden"
      style={{ height: "calc(100dvh - 3.5rem)" }}
    >
      <div className="absolute inset-0 animate-pulse bg-[var(--w-page,#eef1f6)]" />
    </main>
  );
}
