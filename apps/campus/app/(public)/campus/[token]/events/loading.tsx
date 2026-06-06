import { ExploreLoadingShell } from "@/lib/consumer/ExploreLoadingShell";
import { EventsListSkeleton } from "@/lib/consumer/EventsListSkeleton";

export default function EventsLoading() {
  return (
    <ExploreLoadingShell activeTabIndex={1}>
      <EventsListSkeleton rows={6} />
    </ExploreLoadingShell>
  );
}
