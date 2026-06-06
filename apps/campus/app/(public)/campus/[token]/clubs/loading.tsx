import { ExploreLoadingShell } from "@/lib/consumer/ExploreLoadingShell";
import { ClubsListSkeleton } from "@/lib/consumer/ClubsListSkeleton";

export default function ClubsLoading() {
  return (
    <ExploreLoadingShell activeTabIndex={2}>
      <ClubsListSkeleton rows={6} />
    </ExploreLoadingShell>
  );
}
