import { ExploreLoadingShell } from "@/lib/consumer/ExploreLoadingShell";
import { DiningListSkeleton } from "@/lib/consumer/DiningListSkeleton";

export default function DiningLoading() {
  return (
    <ExploreLoadingShell activeTabIndex={3}>
      <DiningListSkeleton rows={4} />
    </ExploreLoadingShell>
  );
}
