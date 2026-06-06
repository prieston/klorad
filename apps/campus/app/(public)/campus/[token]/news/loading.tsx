import { ExploreLoadingShell } from "@/lib/consumer/ExploreLoadingShell";
import { NewsListSkeleton } from "@/lib/consumer/NewsListSkeleton";

export default function NewsLoading() {
  return (
    <ExploreLoadingShell activeTabIndex={0}>
      <NewsListSkeleton rows={6} />
    </ExploreLoadingShell>
  );
}
