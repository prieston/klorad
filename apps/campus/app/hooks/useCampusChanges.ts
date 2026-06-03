import useSWR from "swr";
import type { CampusChange } from "@/lib/changes";

interface ChangesResponse {
  items: CampusChange[];
}

const fetcher = (url: string): Promise<ChangesResponse> =>
  fetch(url, { credentials: "include" }).then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json() as Promise<ChangesResponse>;
  });

/**
 * SWR-backed read of `/api/maps/<mapId>/changes` — drives the campus
 * dashboard's What Changed card. 30s revalidation matches push-stats
 * so the two side-by-side cards refresh together; focus revalidation
 * is on so coming back to the tab refreshes after a content edit.
 */
export function useCampusChanges(mapId: string | null | undefined) {
  const { data, error, isLoading, mutate } = useSWR<ChangesResponse>(
    mapId ? `/api/maps/${mapId}/changes` : null,
    fetcher,
    { revalidateOnFocus: true, dedupingInterval: 5000, refreshInterval: 30_000 },
  );
  return {
    items: data?.items ?? [],
    error,
    isLoading,
    mutate,
  };
}
