/**
 * Loading skeleton for the org-tier dashboard — matches the layout
 * grid that `DashboardClient` settles into (hero pane, then a 4-up
 * KPI row, then a 3-up card row). Plain Tailwind; the `Panel` style
 * is here only for ambient bg-colour so the skeleton blocks don't
 * float on the page background.
 */
export default function OrgLoading() {
  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-4 px-6 py-8 md:px-10">
      <div className="h-[200px] animate-pulse rounded-2xl bg-surface-2" />
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-2xl bg-surface-2"
          />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-[260px] animate-pulse rounded-2xl bg-surface-2"
          />
        ))}
      </div>
    </div>
  );
}
