"use client";

import { useRouter } from "next/navigation";
import { PullToRefresh } from "@klorad/design-system";

/**
 * Mobility wrapper around the DS `PullToRefresh` primitive. Wires
 * `router.refresh` so the pull re-runs server components on the
 * active tab. Opts out on Mapbox surfaces (Map tab) since the map
 * eats vertical drags for panning.
 */
export function MobilityPullToRefresh() {
  const router = useRouter();
  return (
    <PullToRefresh
      onRefresh={() => router.refresh()}
      optOutSelector="[data-mapbox]"
    />
  );
}
