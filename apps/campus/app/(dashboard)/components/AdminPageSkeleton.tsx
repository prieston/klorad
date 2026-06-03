/**
 * Shared loading.tsx skeleton for campus-tier admin screens. Mirrors
 * the standard page chrome the real screens settle into so the visual
 * hand-off between nav-click and content render is calm:
 *
 *   - `max-w-[1280px] px-6 py-8 md:px-10` container
 *   - eyebrow + title (PageHeader-shaped block) + actions
 *   - one or two large blocks below
 *
 * Used by every `app/(dashboard)/org/[orgId]/maps/[mapId]/<tab>/
 * loading.tsx` so nav between News / Events / Clubs / Dining /
 * Identity etc. paints something within a frame instead of leaving
 * the route looking dead until the server response lands.
 */
export function AdminPageSkeleton({
  /** Two-column layout when true — matches the screens with a phone
   *  preview / sidebar (Identity, Reach). Defaults to single-column. */
  withSidebar = false,
}: {
  withSidebar?: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 py-8 md:px-10">
      {/* PageHeader block */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="h-3 w-16 animate-pulse rounded bg-surface-2" />
          <div className="h-7 w-56 animate-pulse rounded bg-surface-2" />
          <div className="h-3 w-80 max-w-full animate-pulse rounded bg-surface-2" />
        </div>
        <div className="hidden shrink-0 gap-2 sm:flex">
          <div className="h-9 w-28 animate-pulse rounded-full bg-surface-2" />
          <div className="h-9 w-28 animate-pulse rounded-full bg-surface-2" />
        </div>
      </div>

      {withSidebar ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <div className="h-40 animate-pulse rounded-2xl bg-surface-2" />
            <div className="h-64 animate-pulse rounded-2xl bg-surface-2" />
          </div>
          <div className="space-y-6">
            <div className="h-72 animate-pulse rounded-2xl bg-surface-2" />
            <div className="h-32 animate-pulse rounded-2xl bg-surface-2" />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="h-32 animate-pulse rounded-2xl bg-surface-2" />
          <div className="h-72 animate-pulse rounded-2xl bg-surface-2" />
        </div>
      )}
    </div>
  );
}
