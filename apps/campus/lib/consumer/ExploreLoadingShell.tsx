import type { ReactNode } from "react";

/**
 * Shared skeleton chrome for the four Explore sub-routes (news,
 * events, clubs, dining). Mirrors the real page's hero + pill-strip
 * + subtitle so route transitions feel like the same surface
 * updating, not a wholesale teardown — the SegmentedTabs underneath
 * each page would otherwise unmount mid-flight and reflow the
 * viewport.
 *
 * The active-tab placeholder accepts a 0-3 index so each `loading.tsx`
 * can fill the right pill without needing access to URL state (which
 * `loading.tsx` doesn't receive in the App Router).
 */
export function ExploreLoadingShell({
  activeTabIndex,
  children,
}: {
  activeTabIndex: 0 | 1 | 2 | 3;
  children: ReactNode;
}) {
  return (
    <section
      aria-hidden
      className="mx-auto max-w-[820px] px-4 py-8 md:px-6 md:py-12"
    >
      <div className="h-9 w-32 animate-pulse rounded-md bg-[var(--brand-line)]" />
      <nav className="mt-6 flex items-center gap-1 overflow-x-auto rounded-full border border-[var(--brand-line)] bg-white p-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={
              i === activeTabIndex
                ? "h-9 w-20 animate-pulse rounded-full bg-[color-mix(in_srgb,var(--brand-primary)_30%,#ffffff)]"
                : "h-9 w-20 rounded-full"
            }
          />
        ))}
      </nav>
      <div className="mt-4 h-4 w-48 animate-pulse rounded-md bg-[var(--brand-line)]" />
      {children}
    </section>
  );
}
