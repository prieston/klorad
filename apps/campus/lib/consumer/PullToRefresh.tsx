"use client";

import { useRouter } from "next/navigation";
import { PullToRefresh as DSPullToRefresh } from "@klorad/design-system";

/**
 * Campus wrapper around the DS `PullToRefresh` primitive. Wires
 * Next's `router.refresh` as the refresh callback so re-running
 * server components picks up any content changes.
 *
 * Opt-out selector defaults to `[data-mappedin]` which is what the
 * MappedIn viewer sets on its wrapper — the map eats vertical drags
 * for panning, so the gesture would fight itself there.
 */
export function PullToRefresh() {
  const router = useRouter();
  return <DSPullToRefresh onRefresh={() => router.refresh()} />;
}
